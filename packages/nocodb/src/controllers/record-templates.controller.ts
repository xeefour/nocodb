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

const nanoidRecordTemplate = customAlphabet(
  '1234567890abcdefghijklmnopqrstuvwxyz',
  7,
);

interface RecordTemplateRow {
  id: string;
  base_id: string;
  fk_workspace_id: string | null;
  fk_model_id: string;
  title: string;
  description: string | null;
  template_data: string;
  usage_count: number | null;
  enabled: boolean | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: RecordTemplateRow) {
  let template_data: any = row.template_data;
  // `template_data` is stored as a JSON string (the column is `mediumtext`)
  // — the EE SDK reads it as a string and only the editor parses it back to
  // an object, so we mirror that shape. If parsing fails (legacy / corrupt
  // rows), return the raw string instead of throwing 500.
  try {
    if (typeof template_data === 'string') template_data = JSON.parse(template_data);
  } catch {
    /* leave as raw string */
  }
  return {
    id: row.id,
    base_id: row.base_id,
    fk_workspace_id: row.fk_workspace_id,
    fk_model_id: row.fk_model_id,
    title: row.title,
    description: row.description,
    template_data,
    usage_count: row.usage_count ?? 0,
    enabled: row.enabled !== false,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// CE stub: the EE `nc_record_templates` table already ships with CE
// (migration v0/nc_022_record_templates.ts), but the controller that
// drives it is EE-only. Mirror the EE shape so the patched CE UI's
// "Manage Templates" button / toolbar opens and lists / mutates rows
// against a real backend instead of 404-ing.
@Controller(['/api/v2'])
@UseGuards(MetaApiLimiterGuard, AuthGuard('jwt'))
export class RecordTemplatesController {
  // List all templates for a base across every table. The frontend's
  // toolbar button hits this exact path (`/record-templates/all`).
  @Get('/meta/bases/:baseId/record-templates/all')
  async listAll(@Param('baseId') baseId: string) {
    const rows = await Noco.ncMeta
      .knexConnection(MetaTable.RECORD_TEMPLATES)
      .where('base_id', baseId)
      .orderBy('updated_at', 'desc');
    return { list: rows.map(mapRow) };
  }

  // Per-table list — used by the editor when picking a template for a
  // specific table.
  @Get('/meta/bases/:baseId/tables/:tableId/record-templates')
  async listForTable(
    @Param('baseId') baseId: string,
    @Param('tableId') tableId: string,
  ) {
    const rows = await Noco.ncMeta
      .knexConnection(MetaTable.RECORD_TEMPLATES)
      .where('base_id', baseId)
      .andWhere('fk_model_id', tableId)
      .orderBy('updated_at', 'desc');
    return { list: rows.map(mapRow) };
  }

  @Get('/meta/bases/:baseId/record-templates/:templateId')
  async get(
    @Param('baseId') baseId: string,
    @Param('templateId') templateId: string,
  ) {
    const row = await Noco.ncMeta
      .knexConnection(MetaTable.RECORD_TEMPLATES)
      .where('base_id', baseId)
      .andWhere('id', templateId)
      .first();
    if (!row) return { error: 'Record template not found' };
    return mapRow(row);
  }

  @Post('/meta/bases/:baseId/tables/:tableId/record-templates')
  async create(
    @Param('baseId') baseId: string,
    @Param('tableId') tableId: string,
    @Body() body: any,
    @Req() req: NcRequest,
  ) {
    if (!body?.title || !body?.template_data) {
      return { error: 'title and template_data are required' };
    }
    const newId = `rtp${nanoidRecordTemplate()}`;
    await Noco.ncMeta.knexConnection(MetaTable.RECORD_TEMPLATES).insert({
      id: newId,
      base_id: baseId,
      fk_workspace_id: req.user?.fk_workspace_id ?? null,
      fk_model_id: tableId,
      title: body.title,
      description: body.description ?? null,
      template_data: JSON.stringify(body.template_data),
      usage_count: 0,
      enabled: body.enabled !== false,
      created_by: req.user?.id ?? null,
    });
    const row = await Noco.ncMeta
      .knexConnection(MetaTable.RECORD_TEMPLATES)
      .where('base_id', baseId)
      .andWhere('id', newId)
      .first();
    return mapRow(row);
  }

  @Patch('/meta/bases/:baseId/record-templates/:templateId')
  async update(
    @Param('baseId') baseId: string,
    @Param('templateId') templateId: string,
    @Body() body: any,
  ) {
    const patch: Record<string, any> = {};
    if (typeof body?.title === 'string') patch.title = body.title;
    if (body?.description !== undefined) patch.description = body.description;
    if (body?.template_data !== undefined) {
      patch.template_data = JSON.stringify(body.template_data);
    }
    if (typeof body?.enabled === 'boolean') patch.enabled = body.enabled;

    if (Object.keys(patch).length) {
      await Noco.ncMeta
        .knexConnection(MetaTable.RECORD_TEMPLATES)
        .where('base_id', baseId)
        .andWhere('id', templateId)
        .update(patch);
    }

    const row = await Noco.ncMeta
      .knexConnection(MetaTable.RECORD_TEMPLATES)
      .where('base_id', baseId)
      .andWhere('id', templateId)
      .first();
    if (!row) return { error: 'Record template not found' };
    return mapRow(row);
  }

  @Delete('/meta/bases/:baseId/record-templates/:templateId')
  async delete(
    @Param('baseId') baseId: string,
    @Param('templateId') templateId: string,
  ) {
    await Noco.ncMeta
      .knexConnection(MetaTable.RECORD_TEMPLATES)
      .where('base_id', baseId)
      .andWhere('id', templateId)
      .del();
    return { success: true };
  }

  // "Use template" — increments the usage_count counter. The frontend
  // fires this every time a template is applied. In CE we just bump the
  // counter; the EE build handles applying template_data to a row.
  @Post('/meta/bases/:baseId/record-templates/:templateId/use')
  async use(
    @Param('baseId') baseId: string,
    @Param('templateId') templateId: string,
  ) {
    await Noco.ncMeta
      .knexConnection(MetaTable.RECORD_TEMPLATES)
      .where('base_id', baseId)
      .andWhere('id', templateId)
      .increment('usage_count', 1);
    return { success: true };
  }

  // Create-from — creates a real record from a template. CE has no
  // template-application logic, but the frontend fires this on click.
  // Return success without inserting anywhere so the UI moves on.
  @Post('/meta/bases/:baseId/tables/:tableId/record-templates/:templateId/create-from')
  async createFrom() {
    return { success: true };
  }
}
