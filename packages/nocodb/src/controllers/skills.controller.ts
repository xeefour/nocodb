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

const nanoidSkill = customAlphabet(
  '1234567890abcdefghijklmnopqrstuvwxyz',
  7,
);

interface SkillRow {
  id: string;
  scope: string | null;
  scope_id: string | null;
  title: string;
  description: string | null;
  category: string | null;
  version: string | null;
  icon: string | null;
  content_hash: string | null;
  enabled: boolean | null;
  source_type: string | null;
  source_ref: string | null;
  source_commit: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

interface SkillPolicyRow {
  id: string;
  scope: string;
  scope_id: string;
  community: string | null;
  allowlist: string | null;
  personal: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

function mapSkill(r: SkillRow) {
  return { ...r };
}

function mapPolicy(r: SkillPolicyRow) {
  let allowlist: any = r.allowlist;
  if (typeof allowlist === 'string') {
    try {
      allowlist = JSON.parse(allowlist);
    } catch {
      /* leave as string */
    }
  }
  return { ...r, allowlist };
}

// CE stub: the EE Skills feature (per-org / per-workspace AI skills with
// policy allow/deny lists) is gated behind a paid plan. The EE-flavored
// frontend still calls these endpoints to list / install / configure
// skills, so without a stub the browser console spams 404s.
//
// Backed by the existing nc_skills + nc_skill_policies tables so the UI
// can list, install, and edit skill records. Skill content resolution
// (fetching the actual prompt content from `source_ref`) is a no-op —
// the EE backend talks to the upstream skill marketplace / repo.
@Controller(['/api/v3'])
@UseGuards(MetaApiLimiterGuard, AuthGuard('jwt'))
export class SkillsController {
  // List skills for a given scope (org / workspace / base).
  @Get('/meta/orgs/:orgId/skills')
  async listForOrg(@Param('orgId') orgId: string) {
    const rows = await Noco.ncMeta
      .knexConnection(MetaTable.SKILLS)
      .where('scope', 'org')
      .andWhere('scope_id', orgId)
      .orderBy('created_at', 'desc');
    return { list: rows.map(mapSkill) };
  }

  @Get('/meta/orgs/:orgId/skill-policies')
  async listOrgPolicies(@Param('orgId') orgId: string) {
    const rows = await Noco.ncMeta
      .knexConnection(MetaTable.SKILL_POLICIES)
      .where('scope', 'org')
      .andWhere('scope_id', orgId);
    return { list: rows.map(mapPolicy) };
  }

  @Get('/meta/workspaces/:workspaceId/skills')
  async listForWorkspace(@Param('workspaceId') workspaceId: string) {
    const rows = await Noco.ncMeta
      .knexConnection(MetaTable.SKILLS)
      .where('scope', 'workspace')
      .andWhere('scope_id', workspaceId)
      .orderBy('created_at', 'desc');
    return { list: rows.map(mapSkill) };
  }

  @Get('/skills/:skillId')
  async get(@Param('skillId') skillId: string) {
    const row = await Noco.ncMeta
      .knexConnection(MetaTable.SKILLS)
      .where('id', skillId)
      .first();
    if (!row) return { error: 'Skill not found' };
    return mapSkill(row);
  }

  @Post('/meta/orgs/:orgId/skills')
  async installForOrg(
    @Param('orgId') orgId: string,
    @Body() body: any,
    @Req() req: NcRequest,
  ) {
    const newId = `skl${nanoidSkill()}`;
    await Noco.ncMeta.knexConnection(MetaTable.SKILLS).insert({
      id: newId,
      scope: 'org',
      scope_id: orgId,
      title: body?.title ?? 'Untitled skill',
      description: body?.description ?? null,
      category: body?.category ?? null,
      version: body?.version ?? null,
      icon: body?.icon ?? null,
      content_hash: body?.content_hash ?? null,
      enabled: body?.enabled !== false,
      source_type: body?.source_type ?? null,
      source_ref: body?.source_ref ?? null,
      source_commit: body?.source_commit ?? null,
      created_by: req.user?.id ?? null,
    });
    const row = await Noco.ncMeta
      .knexConnection(MetaTable.SKILLS)
      .where('id', newId)
      .first();
    return mapSkill(row);
  }

  @Patch('/skills/:skillId')
  async update(@Param('skillId') skillId: string, @Body() body: any) {
    const patch: Record<string, any> = {};
    if (body?.title !== undefined) patch.title = body.title;
    if (body?.description !== undefined) patch.description = body.description;
    if (body?.category !== undefined) patch.category = body.category;
    if (body?.version !== undefined) patch.version = body.version;
    if (body?.icon !== undefined) patch.icon = body.icon;
    if (typeof body?.enabled === 'boolean') patch.enabled = body.enabled;
    if (body?.source_ref !== undefined) patch.source_ref = body.source_ref;
    if (body?.source_commit !== undefined) patch.source_commit = body.source_commit;

    if (Object.keys(patch).length) {
      await Noco.ncMeta
        .knexConnection(MetaTable.SKILLS)
        .where('id', skillId)
        .update(patch);
    }
    const row = await Noco.ncMeta
      .knexConnection(MetaTable.SKILLS)
      .where('id', skillId)
      .first();
    if (!row) return { error: 'Skill not found' };
    return mapSkill(row);
  }

  @Delete('/skills/:skillId')
  async delete(@Param('skillId') skillId: string) {
    await Noco.ncMeta
      .knexConnection(MetaTable.SKILLS)
      .where('id', skillId)
      .del();
    return { success: true };
  }

  // Policy CRUD — same shape as Skills, against nc_skill_policies.
  @Post('/meta/orgs/:orgId/skill-policies')
  async upsertOrgPolicy(
    @Param('orgId') orgId: string,
    @Body() body: any,
    @Req() req: NcRequest,
  ) {
    const existing = await Noco.ncMeta
      .knexConnection(MetaTable.SKILL_POLICIES)
      .where('scope', 'org')
      .andWhere('scope_id', orgId)
      .first();
    const allowlistJson = body?.allowlist
      ? JSON.stringify(body.allowlist)
      : null;

    if (existing) {
      await Noco.ncMeta
        .knexConnection(MetaTable.SKILL_POLICIES)
        .where('id', existing.id)
        .update({
          community: body?.community ?? existing.community,
          allowlist: allowlistJson ?? existing.allowlist,
          personal: body?.personal ?? existing.personal,
          updated_by: req.user?.id ?? null,
        });
    } else {
      await Noco.ncMeta.knexConnection(MetaTable.SKILL_POLICIES).insert({
        id: `skp${nanoidSkill()}`,
        scope: 'org',
        scope_id: orgId,
        community: body?.community ?? null,
        allowlist: allowlistJson,
        personal: body?.personal ?? null,
        created_by: req.user?.id ?? null,
      });
    }
    const row = await Noco.ncMeta
      .knexConnection(MetaTable.SKILL_POLICIES)
      .where('scope', 'org')
      .andWhere('scope_id', orgId)
      .first();
    return mapPolicy(row);
  }
}
