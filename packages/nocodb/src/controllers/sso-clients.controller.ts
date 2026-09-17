import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { customAlphabet } from 'nanoid';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { NcRequest } from '~/interface/config';
import { MetaTable } from '~/utils/globals';
import Noco from '~/Noco';

const nanoidSsoClient = customAlphabet(
  '1234567890abcdefghijklmnopqrstuvwxyz',
  7,
);

interface SsoClientRow {
  id: string;
  type: string | null;
  title: string | null;
  enabled: boolean | null;
  config: string | null;
  fk_user_id: string | null;
  fk_org_id: string | null;
  deleted: boolean | null;
  order: number | null;
  domain_name: string | null;
  domain_name_verified: boolean | null;
  fk_workspace_id: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: SsoClientRow) {
  let config: any = row.config;
  // `config` is JSON-as-text — parse so callers can read it directly.
  try {
    if (typeof config === 'string') config = JSON.parse(config);
  } catch {
    /* leave as raw string */
  }
  return { ...row, config };
}

// CE stub: the EE SSO client manager (OIDC/SAML config + domain
// verification) is gated behind a paid plan. The EE-flavoured frontend
// still calls these endpoints to list/create/edit/delete SSO clients,
// so without a stub it spams 404s in the console.
//
// We back the controller with the existing nc_sso_client table so the
// UI can list, edit, and persist SSO client records. Domain
// verification is a no-op (returns the saved row as-is) — actual
// verification + IdP handshake still requires the EE backend.
@Controller(['/api/v2'])
@UseGuards(MetaApiLimiterGuard, AuthGuard('jwt'))
export class SsoClientsController {
  @Get('/sso-clients')
  async list(@Req() req: NcRequest) {
    const rows = await Noco.ncMeta
      .knexConnection(MetaTable.SSO_CLIENT)
      .where('deleted', false)
      .orderBy('created_at', 'desc');
    return { list: rows.map(mapRow) };
  }

  @Get('/sso-clients/:id')
  async get(@Param('id') id: string) {
    const row = await Noco.ncMeta
      .knexConnection(MetaTable.SSO_CLIENT)
      .where('id', id)
      .first();
    if (!row) return { error: 'SSO client not found' };
    return mapRow(row);
  }

  @Post('/sso-clients')
  async create(@Body() body: any, @Req() req: NcRequest) {
    const newId = `sso${nanoidSsoClient()}`;
    await Noco.ncMeta.knexConnection(MetaTable.SSO_CLIENT).insert({
      id: newId,
      type: body?.type ?? 'oidc',
      title: body?.title ?? null,
      enabled: body?.enabled !== false,
      config: body?.config ? JSON.stringify(body.config) : null,
      fk_user_id: req.user?.id ?? null,
      fk_org_id: body?.fk_org_id ?? null,
      deleted: false,
      order: body?.order ?? 0,
      domain_name: body?.domain_name ?? null,
      domain_name_verified: false,
      fk_workspace_id: req.user?.fk_workspace_id ?? null,
    });
    const row = await Noco.ncMeta
      .knexConnection(MetaTable.SSO_CLIENT)
      .where('id', newId)
      .first();
    return mapRow(row);
  }

  @Patch('/sso-clients/:id')
  async update(@Param('id') id: string, @Body() body: any) {
    const patch: Record<string, any> = {};
    if (body?.type !== undefined) patch.type = body.type;
    if (body?.title !== undefined) patch.title = body.title;
    if (typeof body?.enabled === 'boolean') patch.enabled = body.enabled;
    if (body?.config !== undefined)
      patch.config = body.config ? JSON.stringify(body.config) : null;
    if (body?.fk_org_id !== undefined) patch.fk_org_id = body.fk_org_id;
    if (typeof body?.order === 'number') patch.order = body.order;
    if (body?.domain_name !== undefined) patch.domain_name = body.domain_name;
    if (typeof body?.domain_name_verified === 'boolean')
      patch.domain_name_verified = body.domain_name_verified;

    if (Object.keys(patch).length) {
      await Noco.ncMeta
        .knexConnection(MetaTable.SSO_CLIENT)
        .where('id', id)
        .update(patch);
    }
    const row = await Noco.ncMeta
      .knexConnection(MetaTable.SSO_CLIENT)
      .where('id', id)
      .first();
    if (!row) return { error: 'SSO client not found' };
    return mapRow(row);
  }

  @Delete('/sso-clients/:id')
  async delete(@Param('id') id: string) {
    await Noco.ncMeta
      .knexConnection(MetaTable.SSO_CLIENT)
      .where('id', id)
      .update({ deleted: true });
    return { success: true };
  }
}
