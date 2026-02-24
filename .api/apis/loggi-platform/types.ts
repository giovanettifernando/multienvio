import type { FromSchema } from 'json-schema-to-ts';
import * as schemas from './schemas';

export type AuthenticateV1BodyParam = FromSchema<typeof schemas.AuthenticateV1.body>;
export type AuthenticateV1Response200 = FromSchema<typeof schemas.AuthenticateV1.response['200']>;
export type AuthenticateV1Response400 = FromSchema<typeof schemas.AuthenticateV1.response['400']>;
export type AuthenticateV1Response401 = FromSchema<typeof schemas.AuthenticateV1.response['401']>;
export type AuthenticateV1Response403 = FromSchema<typeof schemas.AuthenticateV1.response['403']>;
export type AuthenticateV1Response429 = FromSchema<typeof schemas.AuthenticateV1.response['429']>;
export type AuthenticateV1Response500 = FromSchema<typeof schemas.AuthenticateV1.response['500']>;
export type AuthenticateV1Response503 = FromSchema<typeof schemas.AuthenticateV1.response['503']>;
export type AuthenticateV2BodyParam = FromSchema<typeof schemas.AuthenticateV2.body>;
export type AuthenticateV2Response200 = FromSchema<typeof schemas.AuthenticateV2.response['200']>;
export type AuthenticateV2Response400 = FromSchema<typeof schemas.AuthenticateV2.response['400']>;
