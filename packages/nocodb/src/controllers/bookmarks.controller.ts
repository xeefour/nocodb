import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { customAlphabet } from 'nanoid';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { NcRequest } from '~/interface/config';
import { MetaTable } from '~/utils/globals';
import Noco from '~/Noco';

// Same id-alphabet as the rest of the meta tables — keeps the bookmark id
// visually consistent with other 7-char prefixed ids.
const nanoidBookmark = customAlphabet(
  '1234567890abcdefghijklmnopqrstuvwxyz',
  7,
);

interface BookmarkGroupRow {
  id: string;
  fk_user_id: string;
  name: string;
  order: number | null;
  meta: string | null;
  created_at: string;
  updated_at: string;
}

interface BookmarkRow {
  id: string;
  fk_user_id: string;
  fk_group_id: string;
  title: string | null;
  target_type: string;
  target_id: string;
  icon: string | null;
  icon_color: string | null;
  icon_type: string | null;
  order: number | null;
  meta: string | null;
  created_at: string;
  updated_at: string;
}

function mapGroup(row: BookmarkGroupRow) {
  return {
    id: row.id,
    fk_user_id: row.fk_user_id,
    name: row.name,
    order: row.order,
    meta: row.meta,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapBookmark(row: BookmarkRow) {
  return {
    id: row.id,
    fk_user_id: row.fk_user_id,
    fk_group_id: row.fk_group_id,
    title: row.title,
    target_type: row.target_type,
    target_id: row.target_id,
    icon: row.icon,
    icon_color: row.icon_color,
    icon_type: row.icon_type,
    order: row.order,
    meta: row.meta,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// CE stub: full bookmark + bookmark-group CRUD backed by the existing
// nc_bookmarks / nc_bookmark_groups tables. The EE build replaces this
// controller with a richer implementation; this fallback gives the patched
// CE UI a real endpoint instead of `Cannot GET /api/v1/bookmarks/check` /
// 404 spam in the console.
@Controller(['/api/v1', '/api/v2'])
@UseGuards(MetaApiLimiterGuard, AuthGuard('jwt'))
export class BookmarksController {
  // CE stub: the patched CE UI calls this on every navigation to ask
  // "does this URL already have a bookmark?". In CE we never seed any,
  // so the answer is always "no" — return an empty list.
  @Get('/bookmarks/check')
  async check(@Query() _q: any) {
    return [];
  }

  // ---------- Bookmark groups ----------

  @Get('/bookmark-groups')
  async listGroups(@Req() req: NcRequest) {
    const userId = req.user?.id;
    if (!userId) return { list: [] };
    const rows = await Noco.ncMeta
      .knexConnection(MetaTable.BOOKMARK_GROUPS)
      .where('fk_user_id', userId)
      .orderBy('order', 'asc');
    return { list: rows.map(mapGroup) };
  }

  @Post('/bookmark-groups')
  async createGroup(@Body() body: any, @Req() req: NcRequest) {
    const userId = req.user?.id;
    if (!userId) return { error: 'Unauthorized' };

    const name = (body?.name ?? '').toString().trim() || 'Untitled Group';
    const newId = `bmg${nanoidBookmark()}`;

    await Noco.ncMeta.knexConnection(MetaTable.BOOKMARK_GROUPS).insert({
      id: newId,
      fk_user_id: userId,
      name,
      order: body?.order ?? 0,
      meta: body?.meta ? JSON.stringify(body.meta) : null,
    });

    const row = await Noco.ncMeta
      .knexConnection(MetaTable.BOOKMARK_GROUPS)
      .where('id', newId)
      .first();
    return mapGroup(row);
  }

  @Patch('/bookmark-groups/:groupId')
  async updateGroup(
    @Param('groupId') groupId: string,
    @Body() body: any,
    @Req() req: NcRequest,
  ) {
    const userId = req.user?.id;
    if (!userId) return { error: 'Unauthorized' };

    const patch: Record<string, any> = {};
    if (typeof body?.name === 'string') patch.name = body.name.trim();
    if (typeof body?.order === 'number') patch.order = body.order;
    if (body?.meta !== undefined) {
      patch.meta = body.meta ? JSON.stringify(body.meta) : null;
    }

    if (Object.keys(patch).length) {
      await Noco.ncMeta
        .knexConnection(MetaTable.BOOKMARK_GROUPS)
        .where('id', groupId)
        .andWhere('fk_user_id', userId)
        .update(patch);
    }

    const row = await Noco.ncMeta
      .knexConnection(MetaTable.BOOKMARK_GROUPS)
      .where('id', groupId)
      .andWhere('fk_user_id', userId)
      .first();
    if (!row) return { error: 'Bookmark group not found' };
    return mapGroup(row);
  }

  @Delete('/bookmark-groups/:groupId')
  async deleteGroup(
    @Param('groupId') groupId: string,
    @Req() req: NcRequest,
  ) {
    const userId = req.user?.id;
    if (!userId) return { error: 'Unauthorized' };

    await Noco.ncMeta
      .knexConnection(MetaTable.BOOKMARKS)
      .where('fk_group_id', groupId)
      .andWhere('fk_user_id', userId)
      .del();

    await Noco.ncMeta
      .knexConnection(MetaTable.BOOKMARK_GROUPS)
      .where('id', groupId)
      .andWhere('fk_user_id', userId)
      .del();

    return { success: true };
  }

  // ---------- Bookmarks ----------

  @Get('/bookmarks')
  async list(@Query('groupId') groupId: string | undefined, @Req() req: NcRequest) {
    const userId = req.user?.id;
    if (!userId) return { list: [] };

    let q = Noco.ncMeta
      .knexConnection(MetaTable.BOOKMARKS)
      .where('fk_user_id', userId)
      .orderBy('order', 'asc');
    if (groupId) q = q.andWhere('fk_group_id', groupId);

    const rows = await q;
    return { list: rows.map(mapBookmark) };
  }

  @Post('/bookmarks')
  async create(@Body() body: any, @Req() req: NcRequest) {
    const userId = req.user?.id;
    if (!userId) return { error: 'Unauthorized' };

    if (!body?.fk_group_id || !body?.target_type || !body?.target_id) {
      return { error: 'fk_group_id, target_type and target_id are required' };
    }

    const newId = `bmk${nanoidBookmark()}`;

    await Noco.ncMeta.knexConnection(MetaTable.BOOKMARKS).insert({
      id: newId,
      fk_user_id: userId,
      fk_group_id: body.fk_group_id,
      title: body.title ?? null,
      target_type: body.target_type,
      target_id: body.target_id,
      icon: body.icon ?? null,
      icon_color: body.icon_color ?? null,
      icon_type: body.icon_type ?? null,
      order: body.order ?? 0,
      meta: body.meta ? JSON.stringify(body.meta) : null,
    });

    const row = await Noco.ncMeta
      .knexConnection(MetaTable.BOOKMARKS)
      .where('id', newId)
      .first();
    return mapBookmark(row);
  }

  @Patch('/bookmarks/:bookmarkId')
  async update(
    @Param('bookmarkId') bookmarkId: string,
    @Body() body: any,
    @Req() req: NcRequest,
  ) {
    const userId = req.user?.id;
    if (!userId) return { error: 'Unauthorized' };

    const patch: Record<string, any> = {};
    if (typeof body?.title === 'string') patch.title = body.title;
    if (typeof body?.fk_group_id === 'string') patch.fk_group_id = body.fk_group_id;
    if (typeof body?.icon === 'string') patch.icon = body.icon;
    if (typeof body?.icon_color === 'string') patch.icon_color = body.icon_color;
    if (typeof body?.icon_type === 'string') patch.icon_type = body.icon_type;
    if (typeof body?.order === 'number') patch.order = body.order;
    if (body?.meta !== undefined) {
      patch.meta = body.meta ? JSON.stringify(body.meta) : null;
    }

    if (Object.keys(patch).length) {
      await Noco.ncMeta
        .knexConnection(MetaTable.BOOKMARKS)
        .where('id', bookmarkId)
        .andWhere('fk_user_id', userId)
        .update(patch);
    }

    const row = await Noco.ncMeta
      .knexConnection(MetaTable.BOOKMARKS)
      .where('id', bookmarkId)
      .andWhere('fk_user_id', userId)
      .first();
    if (!row) return { error: 'Bookmark not found' };
    return mapBookmark(row);
  }

  @Delete('/bookmarks/:bookmarkId')
  async delete(
    @Param('bookmarkId') bookmarkId: string,
    @Req() req: NcRequest,
  ) {
    const userId = req.user?.id;
    if (!userId) return { error: 'Unauthorized' };

    await Noco.ncMeta
      .knexConnection(MetaTable.BOOKMARKS)
      .where('id', bookmarkId)
      .andWhere('fk_user_id', userId)
      .del();

    return { success: true };
  }
}
