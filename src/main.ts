import * as core from '@actions/core'
import OpenAI from 'openai'
import { OctokitClient } from './github'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const prompt: string =
      core.getInput('prompt') || (process.env['PROMPT'] as string)

    if (!process.env['OPENAI_API_KEY']) {
      core.setFailed('Missing OPENAI_API_KEY env var')
      return
    }

    const octokit = new OctokitClient({
      authToken:
        core.getInput('github_token') ||
        (process.env['GITHUB_TOKEN_ID'] as string),
      pullRequestId:
        core.getInput('github_pr_id') || (process.env['GITHUB_PR_ID'] as string)
    })

    const files = await octokit.listFiles()
    let concatenatedFilesContent = ''

    // eslint-disable-next-line github/array-foreach
    files
      .filter(file =>
        file.filename.startsWith(
          core.getInput('files_path') || (process.env['FILES_PATH'] as string)
        )
      )
      .forEach(modifiedFile => {
        concatenatedFilesContent += modifiedFile.patch
      })

    if (!concatenatedFilesContent) {
      core.info('Nothing to analyze')
      return
    }

    const openai = new OpenAI({
      apiKey: process.env['OPENAI_API_KEY']
    })

    const finalPrompt = `${prompt} ${concatenatedFilesContent}`
    const chatResult = await openai.chat.completions
      .create({
        messages: [{ role: 'user', content: finalPrompt }],
        model:
          core.getInput('openai_model') ||
          (process.env['OPENAI_MODEL'] as string),
        temperature: Number(core.getInput('openai_temperature'))
      })
      .asResponse()

    const response = await chatResult.json()

    core.setOutput(
      'chatResult',
      response.choices[0]?.message.content ?? undefined
    )
    const chatResultResponse =
      response.choices[0]?.message.content ?? 'No response from Chat GPT :('
    await octokit.upsertComment(chatResultResponse)

    // todo rajouter un label en fonction du locking ou non
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
