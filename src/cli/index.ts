#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init';
import { auditCommand } from './commands/audit';
import { configCommand } from './commands/config';
const program = new Command();

program
  .name('secure-backend')
  .description('CLI tool for Secure Backend middleware')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize a new secure backend configuration')
  .option(
    '-p, --preset <preset>',
    'Configuration preset (api, webapp, strict)',
    'api'
  )
  .option(
    '-f, --framework <framework>',
    'Target framework (express, koa, fastify, nestjs)',
    'express'
  )
  .option('-o, --output <path>', 'Output directory', '.')
  .option('--typescript', 'Generate TypeScript configuration', false)
  .action(async options => {
    await initCommand({
      preset: options.preset,
      framework: options.framework,
      output: options.output,
      typescript: options.typescript,
    });
  });

program
  .command('audit')
  .description('Audit your application for security vulnerabilities')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('-o, --output <path>', 'Output file for report')
  .option('-f, --format <format>', 'Output format (console, json)', 'console')
  .option('-v, --verbose', 'Verbose output', false)
  .option('--fix', 'Automatically fix issues where possible', false)
  .action(async options => {
    await auditCommand({
      config: options.config,
      output: options.output,
      format: options.format,
      verbose: options.verbose,
      fix: options.fix,
    });
  });

program
  .command('config')
  .description('Configuration management utilities')
  .argument('<action>', 'Action to perform (show, validate, generate, update)')
  .option('-p, --preset <preset>', 'Configuration preset for generate action')
  .option('-o, --output <path>', 'Output file path')
  .option(
    '-f, --format <format>',
    'Output format (json, typescript, javascript)',
    'json'
  )
  .option('-k, --key <key>', 'Configuration key for update action')
  .option('-v, --value <value>', 'Configuration value for update action')
  .action(async (action, options) => {
    await configCommand({
      action: action as 'show' | 'validate' | 'generate' | 'update',
      preset: options.preset,
      output: options.output,
      format: options.format,
      key: options.key,
      value: options.value,
    });
  });

program.parse();
