import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { config as configDotenv } from 'dotenv';
import { cleanEnv } from 'envalid';
import { EnvironmentFile, Environments } from '@/enums/environment.enum';
import envValidationConfig from '@/config/env-validation.config';
import { type CommonEnvKeys } from '@/types/environment.type';
import { resolveAllowedOrigins } from '@/lib/cors-origins';
import appConfig from '@/config/app.config';

export interface IEnvironment {
  getCurrentEnvironment: () => string;
  setEnvironment: (env?: Environments) => void;
  isProd: () => boolean;
  isDev: () => boolean;
}

class Environment implements IEnvironment {
  private _port: number;
  private _env: Environments;
  private _appUrl: string;
  private _clientUrl: string;
  private _allowedOrigins: string[] = [];

  constructor() {
    this.port = Number(process.env.PORT) ?? appConfig.defaultPort;
    this.setEnvironment(process.env.NODE_ENV ?? Environments.DEV);
  }

  get env() {
    return this._env;
  }

  set env(value) {
    this._env = value;
  }

  get port() {
    return this._port;
  }

  set port(value) {
    this._port = value;
  }

  get appUrl() {
    return this._appUrl;
  }

  set appUrl(value) {
    this._appUrl = value;
  }

  get clientUrl() {
    return this._clientUrl;
  }

  set clientUrl(value) {
    this._clientUrl = value;
  }

  /**
   * Every origin allowed to call the API with credentials — `CLIENT_URL` plus
   * the comma-separated `ALLOWED_ORIGINS`, normalised and de-duplicated.
   * Shared by the HTTP CORS middleware and the Socket.IO handshake.
   */
  get allowedOrigins(): string[] {
    return this._allowedOrigins;
  }

  set allowedOrigins(value: string[]) {
    this._allowedOrigins = value;
  }

  private resolveEnvPath(key: CommonEnvKeys): string {
    // On priority bar, .env.[NODE_ENV] has higher priority than default env file (.env)
    // If both are not resolved, error is thrown.
    const rootDir: string = process.cwd();
    const envPath = path.resolve(rootDir, EnvironmentFile[key]);
    const defaultEnvPath = path.resolve(rootDir, EnvironmentFile.DEFAULT);
    return fs.existsSync(envPath) ? envPath : fs.existsSync(defaultEnvPath) ? defaultEnvPath : '';
  }

  private validateEnvValues() {
    const env = cleanEnv(process.env, envValidationConfig);
    this.port = env.PORT;
    this.appUrl = env.APP_BASE_URL;
    this.clientUrl = env.CLIENT_URL;
    this.allowedOrigins = resolveAllowedOrigins(env.CLIENT_URL, env.ALLOWED_ORIGINS);

    if (this.isProd() && !process.env.CLIENT_URL && !env.ALLOWED_ORIGINS) {
      // console, not the winston logger: logger imports this module, so
      // importing it back here would create a circular dependency.
      console.warn(
        `[cors] Neither CLIENT_URL nor ALLOWED_ORIGINS is set; only ${this.clientUrl} ` +
          'is allowed. Requests from the deployed frontend will be rejected with 403.'
      );
    }
  }

  public setEnvironment(env = Environments.DEV): void {
    this.env = env;

    const envKey = Object.keys(Environments).find(
      (key) => Environments[key] === this.env
    ) as keyof typeof Environments;
    const envPath = this.resolveEnvPath(envKey);

    if (envPath) {
      configDotenv({ path: envPath });
    }
    this.validateEnvValues();
  }

  public getCurrentEnvironment() {
    return this.env;
  }

  public isProd() {
    return this.env === Environments.PRODUCTION;
  }

  public isDev() {
    return this.env === Environments.DEV;
  }
}

export default new Environment();
