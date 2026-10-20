module.exports = {
  apps: [
    {
      name: "ticketing-frontend",
      script: "C:\\Windows\\System32\\cmd.exe",
      args: "/c npm run start",
      cwd: "C:\\nginx\\www\\TicketingSystem-Frontend",
      interpreter: "none",
      windowsHide: true,
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};