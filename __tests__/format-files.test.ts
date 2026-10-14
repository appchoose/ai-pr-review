import { formatFiles } from '../src/main'

describe('formatFiles', () => {
  it('keeps only added lines and labels each file', () => {
    const result = formatFiles([
      {
        filename: 'migrations/1_add_index/migration.sql',
        patch:
          '@@ -0,0 +1,2 @@\n+-- comment with *stars*\n+CREATE INDEX CONCURRENTLY "a_idx" ON "a"("b");\n\\ No newline at end of file'
      },
      {
        filename: 'migrations/2_alter/migration.sql',
        patch:
          '@@ -1,2 +1,2 @@\n SELECT 1;\n-DROP TABLE "a";\n+SELECT * FROM "a";\n@@ -10,1 +10,1 @@\n+SELECT 2;'
      },
      { filename: 'migrations/3_removed/migration.sql', patch: '@@ -1 +0,0 @@\n-DROP TABLE "b";' },
      { filename: 'migrations/4_binary/migration.sql' }
    ])

    expect(result).toBe(
      [
        '-- File: migrations/1_add_index/migration.sql',
        '-- comment with *stars*',
        'CREATE INDEX CONCURRENTLY "a_idx" ON "a"("b");',
        '',
        '-- File: migrations/2_alter/migration.sql',
        'SELECT * FROM "a";',
        'SELECT 2;'
      ].join('\n')
    )
  })

  it('returns an empty string when no file adds lines', () => {
    expect(formatFiles([])).toBe('')
  })
})
