import type * as types from './types';
import type { ConfigOptions, FetchResponse } from 'api/dist/core'
import Oas from 'oas';
import APICore from 'api/dist/core';
import definition from './openapi.json';

class SDK {
  spec: Oas;
  core: APICore;

  constructor() {
    this.spec = Oas.init(definition);
    this.core = new APICore(this.spec, 'loggi-platform/v1 (api/6.1.3)');
  }

  /**
   * Optionally configure various options that the SDK allows.
   *
   * @param config Object of supported SDK options and toggles.
   * @param config.timeout Override the default `fetch` request timeout of 30 seconds. This number
   * should be represented in milliseconds.
   */
  config(config: ConfigOptions) {
    this.core.setConfig(config);
  }

  /**
   * If the API you're using requires authentication you can supply the required credentials
   * through this method and the library will magically determine how they should be used
   * within your API request.
   *
   * With the exception of OpenID and MutualTLS, it supports all forms of authentication
   * supported by the OpenAPI specification.
   *
   * @example <caption>HTTP Basic auth</caption>
   * sdk.auth('username', 'password');
   *
   * @example <caption>Bearer tokens (HTTP or OAuth 2)</caption>
   * sdk.auth('myBearerToken');
   *
   * @example <caption>API Keys</caption>
   * sdk.auth('myApiKey');
   *
   * @see {@link https://spec.openapis.org/oas/v3.0.3#fixed-fields-22}
   * @see {@link https://spec.openapis.org/oas/v3.1.0#fixed-fields-22}
   * @param values Your auth credentials for the API; can specify up to two strings or numbers.
   */
  auth(...values: string[] | number[]) {
    this.core.setAuth(...values);
    return this;
  }

  /**
   * If the API you're using offers alternate server URLs, and server variables, you can tell
   * the SDK which one to use with this method. To use it you can supply either one of the
   * server URLs that are contained within the OpenAPI definition (along with any server
   * variables), or you can pass it a fully qualified URL to use (that may or may not exist
   * within the OpenAPI definition).
   *
   * @example <caption>Server URL with server variables</caption>
   * sdk.server('https://{region}.api.example.com/{basePath}', {
   *   name: 'eu',
   *   basePath: 'v14',
   * });
   *
   * @example <caption>Fully qualified server URL</caption>
   * sdk.server('https://eu.api.example.com/v14');
   *
   * @param url Server URL
   * @param variables An object of variables to replace into the server URL.
   */
  server(url: string, variables = {}) {
    this.core.setServer(url, variables);
  }

  /**
   * Solicitação e atualização de token. O campo **idToken** deve ser informado no **Header**
   * _Authorization_ de cada requisição às APIs da Loggi.
   *
   * ### ATENÇÃO!</h2>
   * <div class="warning-docs">
   *   ⚠️ <em>  Esta api de autenticação está depreciada, por favor utilize a <a
   * href="/reference/authenticatev2">versão 2</a> da api de autenticação.</em>
   * </div>
   *
   * @summary Autenticação V1
   * @throws FetchError<400, types.AuthenticateV1Response400> Mensagem do cliente não segue a especificação
   * @throws FetchError<401, types.AuthenticateV1Response401> Falha de autenticação
   * @throws FetchError<403, types.AuthenticateV1Response403> Sem autorização para acessar o serviço
   * @throws FetchError<429, types.AuthenticateV1Response429> Requisições massivas bloqueadas
   * @throws FetchError<500, types.AuthenticateV1Response500> Erro interno
   * @throws FetchError<503, types.AuthenticateV1Response503> Serviço temporariamente indisponível
   */
  authenticateV1(body: types.AuthenticateV1BodyParam): Promise<FetchResponse<200, types.AuthenticateV1Response200>> {
    return this.core.fetch('/oauth2/token', 'post', body);
  }

  /**
   * Solicitação de token para as APIs da Loggi.
   *
   * @summary Autenticação V2
   * @throws FetchError<400, types.AuthenticateV2Response400> Validation Error
   */
  authenticateV2(body: types.AuthenticateV2BodyParam): Promise<FetchResponse<200, types.AuthenticateV2Response200>> {
    return this.core.fetch('/v2/oauth2/token', 'post', body);
  }
}

const createSDK = (() => { return new SDK(); })()
;

export default createSDK;

export type { AuthenticateV1BodyParam, AuthenticateV1Response200, AuthenticateV1Response400, AuthenticateV1Response401, AuthenticateV1Response403, AuthenticateV1Response429, AuthenticateV1Response500, AuthenticateV1Response503, AuthenticateV2BodyParam, AuthenticateV2Response200, AuthenticateV2Response400 } from './types';
