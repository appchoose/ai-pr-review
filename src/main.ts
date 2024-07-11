import * as core from '@actions/core'
import * as github from '@actions/github'
import OpenAI from 'openai'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const prompt: string = core.getInput('prompt')

    if (!process.env['OPENAI_API_KEY']) {
      core.setFailed('Missing OPENAI_API_KEY env var')
      return
    }

    const octokit = github.getOctokit(core.getInput('github_token'))

    const { data: pullRequest } = await octokit.rest.pulls.get({
      owner: 'appchoose',
      repo: 'backend',
      pull_number: core.getInput('github_pr_id') as unknown as number,
      mediaType: {
        format: 'diff'
      }
    })

    core.setOutput('octokit', pullRequest)

    const openai = new OpenAI({
      apiKey: process.env['OPENAI_API_KEY']
    })

    const chatResult = await openai.chat.completions
      .create({
        messages: [{ role: 'user', content: prompt }],
        model: core.getInput('openai_model')
      })
      .asResponse()

    const response = await chatResult.json()

    core.setOutput(
      'chatResult',
      response.choices[0]?.message.content ?? undefined
    )

    // todo rajouter un label en fonction du locking ou non
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
