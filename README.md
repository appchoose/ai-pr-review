# AI Pull Request Review

This action has been created to use OpenAI API to performs some custom analysis on pull request.  
The bot will create and try to update (if existing) a comment with OpenAI result.

## Usage

> [!WARNING] A GitHub token with at least `read:user, repo` scopes is needed.

1. Detect if your SQL migration will lock your database :

   ```yaml
         review-sql-migration:
         timeout-minutes: 5
         name: Review SQL migrations
         runs-on: ubuntu-latest
         steps:
         - name: "Checkout code"
         uses: actions/checkout@v4
           - name: Generate prompt
           run: |
           echo -e "For each distinct SQL query (separated with a line starting by a + sign) at the end of my prompt, knowing that they will be executed into a single transaction, answer in the following format with suggestions and recommendations for how to avoid it, please precise if this locks will prevents other transactions from reading or writing to the table :

              ## Query 1:
                  \`\`\`sql
                  <SQL Query>
                  \`\`\`
                  Locking Analysis:
                    - <start with a warning emoji if this lock the database, then detailed analysis with bold result of the locking result>

                  Suggestions/Alternatives:
                    - <Detailed suggestions>

              ## Query 2:
                  \`\`\`sql
                  <SQL Query>
                  \`\`\`
                  Locking Analysis:
                    - <start with a warning emoji if this lock the database, then detailed analysis with bold result of the locking result>

                  Suggestions/Alternatives:
                    - <Detailed suggestions>" >> prompt.txt

             echo OPENAI_PROMPT=$(cat prompt.txt) >> $GITHUB_ENV
             echo OPENAI_SYSTEM_MESSAGE="You are a SQL expert and knowledgeable about large datasets in Postgres version $POSTGRES_VERSION."
          env:
            POSTGRES_VERSION: 15
        - name: SQL Migration review
          uses: appchoose/ai-pr-review@feat/v1
          with:
            prompt: ${{ env.OPENAI_PROMPT }}
            openai_system_message: ${{ env.OPENAI_SYSTEM_MESSAGE }}
            files_path: "path/to/your/migrations/"
            github_token: ${{ secrets.AI_PR_REVIEW_GITHUB_TOKEN }}
            github_pr_id: ${{ github.event.pull_request.number }}
          env:
            OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
   ```

   This will comment your pull request like this :
   ![migration_openai_comment](./doc/assets/example_migration.png)
