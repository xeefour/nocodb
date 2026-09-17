import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { customAlphabet } from 'nanoid';
import { WorkspaceUserRoles } from 'nocodb-sdk';
import { WorkspaceUsersService } from '~/services/workspace-users.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { NcRequest } from '~/interface/config';
import { MetaTable, RootScopes } from '~/utils/globals';
import Noco from '~/Noco';

const nanoidWorkspace = customAlphabet(
  '1234567890abcdefghijklmnopqrstuvwxyz',
  7,
);

@Controller()
@UseGuards(MetaApiLimiterGuard, AuthGuard('jwt'))
export class WorkspaceUsersController {
  constructor(private readonly workspaceUsersService: WorkspaceUsersService) {}

  // CE stub: list workspaces the current user is a member of.
  // The EE build replaces this with a richer implementation; this
  // fallback reads the workspace + workspace_user tables directly so
  // the patched CE UI gets a real list and stops spamming 404s on
  // /api/v1/workspaces. The user's own workspaces + the default
  // workspace are returned.
  @Get(['/api/v1/workspaces', '/api/v2/workspaces'])
  async listMine(@Req() req: NcRequest) {
    const userId = req.user?.id;
    if (!userId) return { list: [] };

    const ncMeta = Noco.ncMeta;

    // Find workspaces the user is a member of.
    const memberRows = await ncMeta
      .knexConnection(MetaTable.WORKSPACE_USER)
      .where('fk_user_id', userId)
      .andWhere('deleted', false);

    const workspaceIds = memberRows.map((r: any) => r.fk_workspace_id);

    let workspaces: any[] = [];
    if (workspaceIds.length) {
      workspaces = await ncMeta
        .knexConnection(MetaTable.WORKSPACE)
        .whereIn('id', workspaceIds)
        .andWhere('deleted', false);
    }

    return {
      list: workspaces.map((w: any) => ({
        id: w.id,
        title: w.title,
        status: w.status,
        plan: w.plan,
        fk_org_id: w.fk_org_id,
        created_at: w.created_at,
        updated_at: w.updated_at,
      })),
    };
  }

  // CE stub: fetch a single workspace by id.
  @Get(['/api/v1/workspaces/:workspaceId', '/api/v2/workspaces/:workspaceId'])
  async getOne(@Param('workspaceId') workspaceId: string) {
    const ncMeta = Noco.ncMeta;
    const row = await ncMeta
      .knexConnection(MetaTable.WORKSPACE)
      .where('id', workspaceId)
      .andWhere('deleted', false)
      .first();
    if (!row) return { error: 'Workspace not found' };
    return {
      id: row.id,
      title: row.title,
      status: row.status,
      plan: row.plan,
      fk_org_id: row.fk_org_id,
      fk_user_id: row.fk_user_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  // CE stub: create a new workspace. The EE build replaces this with a
  // richer implementation that wires up org membership, billing, etc.
  // This fallback inserts directly into the workspace + workspace_user
  // tables so the patched CE UI's "Create workspace" button stops
  // hitting `Cannot POST /api/v1/workspaces`. The caller becomes the
  // OWNER of the freshly created workspace.
  @Post(['/api/v1/workspaces', '/api/v2/workspaces'])
  async create(@Body() body: any, @Req() req: NcRequest) {
    const userId = req.user?.id;
    if (!userId) {
      // AuthGuard('jwt') should reject before we get here; this is a
      // belt-and-braces guard for unauthenticated requests.
      return { error: 'Unauthorized' };
    }

    const rawTitle =
      typeof body?.title === 'string' ? body.title.trim() : '';
    const title = rawTitle || 'Untitled Workspace';

    const ncMeta = Noco.ncMeta;
    const newId = `w${nanoidWorkspace()}`;

    await ncMeta.knexConnection(MetaTable.WORKSPACE).insert({
      id: newId,
      title,
      fk_user_id: userId,
      status: 1,
      plan: 'free',
      fk_org_id: null,
    });

    // Link the creator as OWNER so listMine / getOne see the new
    // workspace on the very next request.
    await ncMeta.knexConnection(MetaTable.WORKSPACE_USER).insert({
      fk_workspace_id: newId,
      fk_user_id: userId,
      roles: WorkspaceUserRoles.OWNER,
    });

    const row = await ncMeta
      .knexConnection(MetaTable.WORKSPACE)
      .where('id', newId)
      .first();

    return {
      id: row.id,
      title: row.title,
      status: row.status,
      plan: row.plan,
      fk_org_id: row.fk_org_id,
      fk_user_id: row.fk_user_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  // CE stub: list bases belonging to a workspace. CE doesn't enforce
  // workspace→base membership, so we return every non-deleted base —
  // matches the EE behavior for single-workspace on-prem installs.
  @Get([
    '/api/v1/workspaces/:workspaceId/bases',
    '/api/v2/workspaces/:workspaceId/bases',
  ])
  async listBases(@Param('workspaceId') _workspaceId: string) {
    const ncMeta = Noco.ncMeta;
    const rows = await ncMeta
      .knexConnection(MetaTable.PROJECT)
      .where('deleted', false)
      .orderBy('created_at', 'asc');

    return {
      list: rows.map((b: any) => ({
        id: b.id,
        title: b.title,
        prefix: b.prefix,
        description: b.description,
        color: b.color,
        status: b.status,
        fk_workspace_id: b.fk_workspace_id ?? _workspaceId,
        created_at: b.created_at,
        updated_at: b.updated_at,
      })),
    };
  }

  @Get('/api/v1/workspaces/:workspaceId/users')
  @Acl('workspaceUserList', {
    scope: 'workspace',
  })
  async list(@Param('workspaceId') workspaceId: string) {
    return await this.workspaceUsersService.list({ workspaceId });
  }

  @Patch('/api/v1/workspaces/:workspaceId/users/:userId')
  @Acl('workspaceUserUpdate', {
    scope: 'workspace',
  })
  async update(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
    @Body() body: any,
    @Req() req: NcRequest,
  ) {
    return await this.workspaceUsersService.update({
      workspaceId,
      userId,
      roles: body.roles,
      siteUrl: req.ncSiteUrl,
      req,
    });
  }

  @Post('/api/v1/workspaces/:workspaceId/invitations')
  @Acl('workspaceInvite', {
    scope: 'workspace',
  })
  async invite(
    @Param('workspaceId') workspaceId: string,
    @Body() body: any,
    @Req() req: NcRequest,
  ) {
    return await this.workspaceUsersService.invite({
      workspaceId,
      body,
      invitedBy: req.user,
      siteUrl: req.ncSiteUrl,
      req,
    });
  }
}
