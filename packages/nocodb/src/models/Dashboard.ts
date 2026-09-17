import type { NcContext } from '~/interface/config';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import {
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import { customAlphabet } from 'nanoid';

const nid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 14);

export default class Dashboard {
  id?: string;
  base_id?: string;
  fk_workspace_id?: string;
  title?: string;
  description?: string;
  meta?: any;
  order?: number;
  created_by?: string;
  owned_by?: string;
  uuid?: string;
  password?: string;
  fk_custom_url_id?: string;
  created_at?: string;
  updated_at?: string;
  deleted?: boolean;

  constructor(dashboard: Partial<Dashboard>) {
    Object.assign(this, dashboard);
  }

  public static async get(
    context: NcContext,
    dashboardId: string,
    ncMeta = Noco.ncMeta,
    includeDeleted = false,
  ) {
    let dashboard = await NocoCache.get(
      context,
      `${CacheScope.DASHBOARD}:${dashboardId}`,
      CacheGetType.TYPE_OBJECT,
    );

    if (!dashboard) {
      dashboard = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.DASHBOARDS,
        dashboardId,
      );

      if (dashboard) {
        dashboard = prepareForResponse(dashboard, ['meta']);
        NocoCache.set(
          context,
          `${CacheScope.DASHBOARD}:${dashboardId}`,
          dashboard,
        );
      }
    }

    if (dashboard?.deleted && !includeDeleted) return null;

    return dashboard && new Dashboard(dashboard);
  }

  static async list(
    context: NcContext,
    baseId: string,
    ncMeta = Noco.ncMeta,
    includeDeleted = false,
  ) {
    const cachedList = await NocoCache.getList(context, CacheScope.DASHBOARD, [
      baseId,
    ]);
    let { list: dashboardList } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !dashboardList.length) {
      dashboardList = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.DASHBOARDS,
        {
          condition: { base_id: baseId },
          orderBy: { created_at: 'asc' },
        },
      );

      if (dashboardList) {
        dashboardList = dashboardList.map((d) =>
          prepareForResponse(d, ['meta']),
        );
        await NocoCache.setList(
          context,
          CacheScope.DASHBOARD,
          [baseId],
          dashboardList,
        );
      }
    }

    if (!includeDeleted) {
      dashboardList = dashboardList.filter((d) => !d.deleted);
    }

    return dashboardList?.map((d) => new Dashboard(d));
  }

  static async insert(
    context: NcContext,
    baseId: string,
    dashboard: Partial<Dashboard>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(dashboard, [
      'title',
      'description',
      'meta',
      'order',
      'created_by',
      'owned_by',
      'uuid',
      'password',
      'fk_custom_url_id',
    ]);

    insertObj.id = dashboard.id || nid();
    insertObj.base_id = baseId;
    insertObj.fk_workspace_id = context.workspace_id;
    insertObj.created_at = new Date();
    insertObj.updated_at = insertObj.created_at;

    if (insertObj.meta && typeof insertObj.meta !== 'string') {
      insertObj.meta = JSON.stringify(insertObj.meta);
    }

    const row = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.DASHBOARDS,
      insertObj,
    );

    await NocoCache.set(
      context,
      `${CacheScope.DASHBOARD}:${insertObj.id}`,
      row,
    );
    await NocoCache.appendToList(
      context,
      CacheScope.DASHBOARD,
      [baseId],
      row,
    );

    return new Dashboard(row);
  }

  static async update(
    context: NcContext,
    dashboardId: string,
    dashboard: Partial<Dashboard>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(dashboard, [
      'title',
      'description',
      'meta',
      'order',
      'uuid',
      'password',
      'fk_custom_url_id',
      'owned_by',
    ]);
    updateObj.updated_at = new Date();

    if (updateObj.meta && typeof updateObj.meta !== 'string') {
      updateObj.meta = JSON.stringify(updateObj.meta);
    }

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.DASHBOARDS,
      prepareForDb(updateObj, ['meta']),
      dashboardId,
    );

    await NocoCache.update(
      context,
      `${CacheScope.DASHBOARD}:${dashboardId}`,
      updateObj,
    );

    return this.get(context, dashboardId, ncMeta);
  }

  static async softDelete(
    context: NcContext,
    dashboardId: string,
    ncMeta = Noco.ncMeta,
  ) {
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.DASHBOARDS,
      { deleted: true, updated_at: new Date() },
      dashboardId,
    );

    await NocoCache.update(context, `${CacheScope.DASHBOARD}:${dashboardId}`, {
      deleted: true,
    });
    return this.get(context, dashboardId, ncMeta);
  }

  static async delete(
    context: NcContext,
    dashboardId: string,
    ncMeta = Noco.ncMeta,
  ) {
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.DASHBOARDS,
      dashboardId,
    );

    await NocoCache.del(context, `${CacheScope.DASHBOARD}:${dashboardId}`);
    return null;
  }

  static async deleteByBaseId(
    context: NcContext,
    baseId: string,
    ncMeta = Noco.ncMeta,
  ) {
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.DASHBOARDS,
      { base_id: baseId },
    );

    return true;
  }
}
