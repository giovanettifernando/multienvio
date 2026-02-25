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
    this.core = new APICore(this.spec, 'loggi-platform/v1.9 (api/6.1.3)');
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
   * Autenticação OAuth2 V2. Retorna idToken e expiresIn.
   *
   * @summary Criar/Atualizar Token
   */
  requestOAuthToken(body: types.RequestOAuthTokenBodyParam): Promise<FetchResponse<200, types.RequestOAuthTokenResponse200>> {
    return this.core.fetch('/v2/oauth2/token', 'post', body);
  }

  /**
   * Cotação de frete. Retorna opções de preço e prazo.
   *
   * @summary Criar Cotação
   */
  quote(body: types.QuoteBodyParam, metadata: types.QuoteMetadataParam): Promise<FetchResponse<200, types.QuoteResponse200>> {
    return this.core.fetch('/v1/companies/{company_id}/quotations', 'post', body, metadata);
  }

  /**
   * Cria envios de forma assíncrona. Retorna loggiKey e trackingCode para cada pacote.
   * O processamento é feito em background — aguarde webhook ou polling para confirmar.
   *
   * @summary Criar Envio Assíncrono
   */
  createAsyncShipment(body: types.CreateAsyncShipmentBodyParam, metadata: types.CreateAsyncShipmentMetadataParam): Promise<FetchResponse<200, types.CreateAsyncShipmentResponse200>> {
    return this.core.fetch('/v1/companies/{company_id}/async-shipments', 'post', body, metadata);
  }

  /**
   * Gera etiquetas em PDF (base64 ou URL) a partir dos loggiKeys.
   * Disponível somente após confirmação do processamento do pacote.
   *
   * @summary Criar Etiqueta
   */
  createLabel(body: types.CreateLabelBodyParam, metadata: types.CreateLabelMetadataParam): Promise<FetchResponse<200, types.CreateLabelResponse200>> {
    return this.core.fetch('/v1/companies/{company_id}/labels', 'post', body, metadata);
  }

  /**
   * Consulta o rastreamento de um pacote pelo tracking code.
   *
   * @summary Consultar Rastreamento
   */
  getTracking(metadata: types.GetTrackingMetadataParam): Promise<FetchResponse<200, types.GetTrackingResponse200>> {
    return this.core.fetch('/v1/companies/{company_id}/packages/{tracking_code}/tracking', 'get', metadata);
  }
}

const createSDK = (() => { return new SDK(); })()
;

export default createSDK;

export type {
  // Auth
  RequestOAuthTokenBodyParam,
  RequestOAuthTokenResponse200,
  RequestOAuthTokenResponse400,
  RequestOAuthTokenResponse401,
  RequestOAuthTokenResponse403,
  RequestOAuthTokenResponse429,
  RequestOAuthTokenResponse500,
  RequestOAuthTokenResponse503,
  // Quote
  QuoteBodyParam,
  QuoteMetadataParam,
  QuoteResponse200,
  QuoteResponse400,
  QuoteResponse401,
  QuoteResponse403,
  QuoteResponse404,
  QuoteResponse429,
  QuoteResponse500,
  QuoteResponse503,
  // Async Shipment
  CreateAsyncShipmentBodyParam,
  CreateAsyncShipmentMetadataParam,
  CreateAsyncShipmentResponse200,
  CreateAsyncShipmentResponse400,
  CreateAsyncShipmentResponse401,
  CreateAsyncShipmentResponse403,
  CreateAsyncShipmentResponse429,
  CreateAsyncShipmentResponse500,
  CreateAsyncShipmentResponse503,
  // Label
  CreateLabelBodyParam,
  CreateLabelMetadataParam,
  CreateLabelResponse200,
  CreateLabelResponse400,
  CreateLabelResponse401,
  CreateLabelResponse403,
  CreateLabelResponse429,
  CreateLabelResponse500,
  CreateLabelResponse503,
  // Tracking
  GetTrackingMetadataParam,
  GetTrackingResponse200,
  GetTrackingResponse400,
  GetTrackingResponse401,
  GetTrackingResponse403,
  GetTrackingResponse404,
  GetTrackingResponse429,
  GetTrackingResponse500,
  GetTrackingResponse503,
} from './types';
