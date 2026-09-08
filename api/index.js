// Vercel Serverless Function entrypoint for Express application
const serverModule = require("../dist/server");
const app = serverModule.default || serverModule.app || serverModule;

module.exports = app;
