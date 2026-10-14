import * as core from '@actions/core'
import OpenAI from 'openai'
import { OctokitClient } from './github'
import { ChatCompletionMessageParam } from 'openai/resources'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    if (!process.env['OPENAI_API_KEY']) {
      core.setFailed('Missing OPENAI_API_KEY env var')
      return
    }

    const octokit = new OctokitClient({
      authToken: core.getInput('github_token') || (process.env['GITHUB_TOKEN_ID'] as string),
      pullRequestId: core.getInput('github_pr_id') || (process.env['GITHUB_PR_ID'] as string)
    })

    const filesPath = core.getInput('files_path') || (process.env['FILES_PATH'] as string)
    const files = await octokit.listFiles()
    const concatenatedFilesContent = formatFiles(
      files.filter(file => file.filename.startsWith(filesPath))
    )

    if (!concatenatedFilesContent) {
      core.info('No files is matching the given files_path.')
      return
    }

    const finalPrompt = generatePrompt(concatenatedFilesContent)
    const promptResponse = await executePrompt(finalPrompt)
    core.setOutput('chatResult', promptResponse.choices[0]?.message.content ?? undefined)
    const chatResultResponse =
      promptResponse.choices[0]?.message.content ?? 'No response from Chat GPT :('
    await octokit.upsertComment(chatResultResponse)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

/**
 * Keeps only the lines each file adds, so the model never mistakes a removed
 * line or a hunk header for a statement that will run, and prefixes each file
 * with its name so statements from different migrations stay distinguishable.
 */
export const formatFiles = (files: { filename: string; patch?: string | undefined }[]): string =>
  files
    .map(file => {
      const addedLines = (file.patch ?? '')
        .split('\n')
        .filter(line => line.startsWith('+'))
        .map(line => line.slice(1))
        .join('\n')
        .trim()

      return addedLines ? `-- File: ${file.filename}\n${addedLines}` : ''
    })
    .filter(Boolean)
    .join('\n\n')

const generatePrompt = (contentToAnalyze: string): string => {
  const prompt = `
    ${core.getInput('prompt') || (process.env['PROMPT'] as string)} \n
    Answer me in the following language ${core.getInput('language')}:\n
    Content : \n \`\`\`${contentToAnalyze}\`\`\`\n\n
  `

  core.info(`Prompt: ${prompt}`)

  return prompt
}

const DEFAULT_SYSTEM_MESSAGE = `You are a SQL expert specializing in PostgreSQL 18 and large-scale databases.

Key context about the production environment:
- Several tables contain millions of rows. Always consider query performance and lock impact.
- Use CONCURRENTLY for index creation (CREATE INDEX CONCURRENTLY) to avoid blocking reads/writes on large tables.
- For schema changes on large tables (e.g., adding a NOT NULL constraint), prefer a safe multi-step approach:
  1. Add the constraint as NOT VALID first.
  2. Backfill or fix data if needed.
  3. VALIDATE the constraint in a separate step.
- The ORM is Prisma. Prisma sends each migration file to PostgreSQL as one multi-statement script, which PostgreSQL runs as a single implicit transaction. CREATE INDEX CONCURRENTLY and other statements that cannot run inside a transaction block only work when they are the sole statement of their migration file, so recommend splitting them into a dedicated migration file.
- Each file in the content is introduced by a "-- File: <path>" line. Only the lines added by the pull request are included.
- Always flag migrations that could lock a table for an extended period on millions of rows.`

const executePrompt = async (
  prompt: string
): Promise<{ choices: { message: { content: string } }[] }> => {
  const openai = new OpenAI({
    apiKey: process.env['OPENAI_API_KEY']
  })

  const messages: ChatCompletionMessageParam[] = []
  const systemMessage = core.getInput('openai_system_message')
  messages.push({
    role: 'system',
    content: systemMessage
      ? `${DEFAULT_SYSTEM_MESSAGE}\n\n${systemMessage}`
      : DEFAULT_SYSTEM_MESSAGE
  })
  messages.push({ role: 'user', content: prompt })

  core.info('Calling OpenAI...')
  try {
    const chatResult = await openai.chat.completions
      .create({
        messages,
        model: core.getInput('openai_model') || (process.env['OPENAI_MODEL'] as string),
        reasoning_effort: 'high'
      })
      .asResponse()
    core.info(`Chat result :`)
    const result = await chatResult.json()
    return result
  } catch (error) {
    core.error(`Error calling OpenAI: ${error}`)
    throw error
  }
}
