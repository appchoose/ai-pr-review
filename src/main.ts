import * as core from '@actions/core'
import OpenAI from 'openai'
import { OctokitClient } from './github'

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

    let concatenatedFilesContent = ''
    const files = await octokit.listFiles()

    // eslint-disable-next-line github/array-foreach
    files
      .filter(file =>
        file.filename.startsWith(
          core.getInput('files_path') || (process.env['FILES_PATH'] as string)
        )
      )
      .forEach(modifiedFile => {
        concatenatedFilesContent += modifiedFile.patch?.replace(/@@(.*)+@@/, '').trim()
      })

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

const generatePrompt = (contentToAnalyze: string): string => {
  const prompt = `
    ${core.getInput('prompt') || (process.env['PROMPT'] as string)} \n\n
    Content : \n \`\`\`${contentToAnalyze}\`\`\`\n\n
    Answer me in the following language ${core.getInput('language')}:\n\n
    Use markdown formatting for your response.\n\n
  `

  core.info(`Prompt: ${prompt}`)

  return prompt
}

const executePrompt = async (
  prompt: string
): Promise<{ choices: { message: { content: string } }[] }> => {
  const openai = new OpenAI({
    apiKey: process.env['OPENAI_API_KEY']
  })

  const chatResult = await openai.chat.completions
    .create({
      messages: [{ role: 'user', content: prompt }],
      model: core.getInput('openai_model') || (process.env['OPENAI_MODEL'] as string),
      temperature: Number(core.getInput('openai_temperature')),
      max_tokens: Number(core.getInput('openai_max_tokens'))
    })
    .asResponse()

  return chatResult.json()
}
