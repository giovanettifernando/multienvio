import type { FromSchema } from 'json-schema-to-ts';
import * as schemas from './schemas';

// Auth
export type RequestOAuthTokenBodyParam = FromSchema<typeof schemas.RequestOAuthToken.body>;
export type RequestOAuthTokenResponse200 = FromSchema<typeof schemas.RequestOAuthToken.response['200']>;
export type RequestOAuthTokenResponse400 = FromSchema<typeof schemas.RequestOAuthToken.response['400']>;
export type RequestOAuthTokenResponse401 = FromSchema<typeof schemas.RequestOAuthToken.response['401']>;
export type RequestOAuthTokenResponse403 = FromSchema<typeof schemas.RequestOAuthToken.response['403']>;
export type RequestOAuthTokenResponse429 = FromSchema<typeof schemas.RequestOAuthToken.response['429']>;
export type RequestOAuthTokenResponse500 = FromSchema<typeof schemas.RequestOAuthToken.response['500']>;
export type RequestOAuthTokenResponse503 = FromSchema<typeof schemas.RequestOAuthToken.response['503']>;

// Quote
export type QuoteBodyParam = FromSchema<typeof schemas.Quote.body>;
export type QuoteMetadataParam = FromSchema<typeof schemas.Quote.metadata>;
export type QuoteResponse200 = FromSchema<typeof schemas.Quote.response['200']>;
export type QuoteResponse400 = FromSchema<typeof schemas.Quote.response['400']>;
export type QuoteResponse401 = FromSchema<typeof schemas.Quote.response['401']>;
export type QuoteResponse403 = FromSchema<typeof schemas.Quote.response['403']>;
export type QuoteResponse404 = FromSchema<typeof schemas.Quote.response['404']>;
export type QuoteResponse429 = FromSchema<typeof schemas.Quote.response['429']>;
export type QuoteResponse500 = FromSchema<typeof schemas.Quote.response['500']>;
export type QuoteResponse503 = FromSchema<typeof schemas.Quote.response['503']>;

// Async Shipment
export type CreateAsyncShipmentBodyParam = FromSchema<typeof schemas.CreateAsyncShipment.body>;
export type CreateAsyncShipmentMetadataParam = FromSchema<typeof schemas.CreateAsyncShipment.metadata>;
export type CreateAsyncShipmentResponse200 = FromSchema<typeof schemas.CreateAsyncShipment.response['200']>;
export type CreateAsyncShipmentResponse400 = FromSchema<typeof schemas.CreateAsyncShipment.response['400']>;
export type CreateAsyncShipmentResponse401 = FromSchema<typeof schemas.CreateAsyncShipment.response['401']>;
export type CreateAsyncShipmentResponse403 = FromSchema<typeof schemas.CreateAsyncShipment.response['403']>;
export type CreateAsyncShipmentResponse429 = FromSchema<typeof schemas.CreateAsyncShipment.response['429']>;
export type CreateAsyncShipmentResponse500 = FromSchema<typeof schemas.CreateAsyncShipment.response['500']>;
export type CreateAsyncShipmentResponse503 = FromSchema<typeof schemas.CreateAsyncShipment.response['503']>;

// Label
export type CreateLabelBodyParam = FromSchema<typeof schemas.CreateLabel.body>;
export type CreateLabelMetadataParam = FromSchema<typeof schemas.CreateLabel.metadata>;
export type CreateLabelResponse200 = FromSchema<typeof schemas.CreateLabel.response['200']>;
export type CreateLabelResponse400 = FromSchema<typeof schemas.CreateLabel.response['400']>;
export type CreateLabelResponse401 = FromSchema<typeof schemas.CreateLabel.response['401']>;
export type CreateLabelResponse403 = FromSchema<typeof schemas.CreateLabel.response['403']>;
export type CreateLabelResponse429 = FromSchema<typeof schemas.CreateLabel.response['429']>;
export type CreateLabelResponse500 = FromSchema<typeof schemas.CreateLabel.response['500']>;
export type CreateLabelResponse503 = FromSchema<typeof schemas.CreateLabel.response['503']>;

// Tracking
export type GetTrackingMetadataParam = FromSchema<typeof schemas.GetTracking.metadata>;
export type GetTrackingResponse200 = FromSchema<typeof schemas.GetTracking.response['200']>;
export type GetTrackingResponse400 = FromSchema<typeof schemas.GetTracking.response['400']>;
export type GetTrackingResponse401 = FromSchema<typeof schemas.GetTracking.response['401']>;
export type GetTrackingResponse403 = FromSchema<typeof schemas.GetTracking.response['403']>;
export type GetTrackingResponse404 = FromSchema<typeof schemas.GetTracking.response['404']>;
export type GetTrackingResponse429 = FromSchema<typeof schemas.GetTracking.response['429']>;
export type GetTrackingResponse500 = FromSchema<typeof schemas.GetTracking.response['500']>;
export type GetTrackingResponse503 = FromSchema<typeof schemas.GetTracking.response['503']>;
