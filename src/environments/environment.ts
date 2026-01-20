// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  // For Codespaces: Replace -4200 with -3001 in the hostname
  proxyUrl: window.location.origin.replace('-4200.app.github.dev', '-3001.app.github.dev') + '/api/claude',
  appSecret: 'dev-secret-change-in-production' // This will be visible in client code, set same value in server's APP_SECRET env var
};
