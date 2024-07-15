import { getOctokit, context } from '@actions/github'
import { info } from '@actions/core'

interface OctokitClientOptions {
  authToken: string
  pullRequestId: string
}

export class OctokitClient {
  private octokit
  private readonly repo: string
  private readonly owner: string
  private readonly pullRequestId: number

  constructor(options: OctokitClientOptions) {
    this.octokit = getOctokit(options.authToken)
    this.repo = context.repo.repo
    this.owner = context.repo.owner
    this.pullRequestId = Number(options.pullRequestId)
  }

  async getAuthenticatedUserId(): Promise<number> {
    return (await this.octokit.rest.users.getAuthenticated()).data.id
  }

  async upsertComment(comment: string): Promise<void> {
    const comments = await this.octokit.rest.issues.listComments({
      owner: this.owner,
      repo: this.repo,
      issue_number: this.pullRequestId
    })

    const authenticatedUserId = await this.getAuthenticatedUserId()
    const myComments = comments.data.filter(
      commentToFilter => commentToFilter.user?.id === authenticatedUserId
    )

    if (myComments.length > 0) {
      await this.octokit.rest.issues.updateComment({
        owner: this.owner,
        repo: this.repo,
        issue_number: this.pullRequestId,
        body: comment,
        comment_id: myComments[0].id
      })
      info(`Updated comment : ${myComments[0].id}.`)
    } else {
      const result = await this.octokit.rest.issues.createComment({
        owner: this.owner,
        repo: this.repo,
        issue_number: this.pullRequestId,
        body: comment
      })
      info(`Added new comment : ${result.data.id}.`)
    }
  }

  async listFiles(): Promise<{ filename: string; patch?: string | undefined }[]> {
    const { data: files } = await this.octokit.rest.pulls.listFiles({
      owner: this.owner,
      repo: this.repo,
      pull_number: this.pullRequestId,
      mediaType: {
        format: 'json'
      }
    })

    return files
  }
}
