// Root ESLint config - delegates to subprojects
// This prevents "Could not find config file" errors for root-level files

export default [
  {
    // Ignore everything at root level - subprojects have their own configs
    ignores: [
      '.vscode/**',
      'docs/**',
      'infra/**',
      'IP/**',
      'TESTS/**',
      '__mocks__/**',
      'Gogga-mirror/**',
      '*.md',
      '*.txt',
      '*.json',
      '*.yml',
      '*.yaml',
      '*.sh',
      '*.py',
      'Dockerfile*',
      // Subprojects manage their own linting
      'gogga-frontend/**',
      'gogga-backend/**',
      'gogga-admin/**',
      'gogga-cepo/**',
      'gogga-proxy/**',
    ],
  },
];
