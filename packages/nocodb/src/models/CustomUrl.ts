import { customAlphabet } from 'nanoid';
import type { CustomUrlType } from 'nocodb-sdk';
import { MetaTable } from '~/utils/globals';
import Noco from '~/Noco';

// Same id alphabet as Workspace.ts / Bookmark.ts — visually consistent
// with other 7-char prefixed ids. Prefix `cu` to keep custom_url rows
// distinct from shared-base rows when scanning the table by id.
const nanoidCustomUrl = customAlphabet(
  '1234567890abcdefghijklmnopqrstuvwxyz',
  7,
);

export default class CustomUrl implements CustomUrlType {
  public id?: string;
  public fk_workspace_id?: string;
  public base_id?: string;
  public fk_model_id?: string;
  public view_id?: string;
  public fk_dashboard_id?: string;
  public original_path?: string;
  public custom_path?: string;

  constructor(customUrl: Partial<CustomUrl>) {
    Object.assign(this, customUrl);
  }

  public static async get(
    params: Partial<Pick<CustomUrl, 'id' | 'view_id' | 'custom_path'>>,
    ncMeta = Noco.ncMeta,
  ) {
    // Mirror how shared-bases.service.ts looks the row up — match on
    // either id OR custom_path so callers that only know one of them
    // still get a hit.
    if (params.id) {
      const row = await ncMeta
        .knexConnection(MetaTable.CUSTOM_URLS)
        .where('id', params.id)
        .first();
      return row ? new CustomUrl(row) : ({} as CustomUrl);
    }
    if (params.view_id) {
      const row = await ncMeta
        .knexConnection(MetaTable.CUSTOM_URLS)
        .where('view_id', params.view_id)
        .first();
      return row ? new CustomUrl(row) : ({} as CustomUrl);
    }
    if (params.custom_path) {
      const row = await ncMeta
        .knexConnection(MetaTable.CUSTOM_URLS)
        .where('custom_path', params.custom_path)
        .first();
      return row ? new CustomUrl(row) : ({} as CustomUrl);
    }
    return {} as CustomUrl;
  }

  public static async getCustomUrlByCustomPath(
    customPath: string,
    ncMeta = Noco.ncMeta,
  ): Promise<CustomUrl | undefined> {
    const row = await ncMeta
      .knexConnection(MetaTable.CUSTOM_URLS)
      .where('custom_path', customPath)
      .first();
    return row ? new CustomUrl(row) : undefined;
  }

  public static async insert(
    customUrl: Partial<CustomUrl>,
    ncMeta = Noco.ncMeta,
  ) {
    // `base_id` is part of the composite primary key and the schema
    // declares it NOT NULL — refuse to insert rather than let the DB
    // throw an opaque constraint error.
    if (!customUrl.base_id) {
      throw new Error('CustomUrl.insert: base_id is required');
    }

    const id = customUrl.id ?? `cu${nanoidCustomUrl()}`;
    await ncMeta.knexConnection(MetaTable.CUSTOM_URLS).insert({
      id,
      fk_workspace_id: customUrl.fk_workspace_id ?? null,
      base_id: customUrl.base_id,
      fk_model_id: customUrl.fk_model_id ?? null,
      view_id: customUrl.view_id ?? null,
      fk_dashboard_id: customUrl.fk_dashboard_id ?? null,
      original_path: customUrl.original_path ?? null,
      custom_path: customUrl.custom_path ?? null,
    });
    return new CustomUrl({ id, ...customUrl });
  }

  public static async list(
    params: Partial<
      Pick<
        CustomUrl,
        'fk_workspace_id' | 'base_id' | 'fk_model_id' | 'fk_dashboard_id'
      >
    >,
    ncMeta = Noco.ncMeta,
  ) {
    let q = ncMeta.knexConnection(MetaTable.CUSTOM_URLS);
    if (params.fk_workspace_id) q = q.andWhere('fk_workspace_id', params.fk_workspace_id);
    if (params.base_id) q = q.andWhere('base_id', params.base_id);
    if (params.fk_model_id) q = q.andWhere('fk_model_id', params.fk_model_id);
    if (params.fk_dashboard_id) q = q.andWhere('fk_dashboard_id', params.fk_dashboard_id);
    const rows = await q;
    return rows.map((r: any) => new CustomUrl(r));
  }

  public static async update(
    id: string,
    customUrl: Partial<CustomUrl>,
    ncMeta = Noco.ncMeta,
  ) {
    if (!id) return {} as CustomUrl;
    const patch: Record<string, any> = {};
    if (customUrl.fk_workspace_id !== undefined)
      patch.fk_workspace_id = customUrl.fk_workspace_id;
    if (customUrl.fk_model_id !== undefined) patch.fk_model_id = customUrl.fk_model_id;
    if (customUrl.view_id !== undefined) patch.view_id = customUrl.view_id;
    if (customUrl.fk_dashboard_id !== undefined)
      patch.fk_dashboard_id = customUrl.fk_dashboard_id;
    if (customUrl.original_path !== undefined)
      patch.original_path = customUrl.original_path;
    if (customUrl.custom_path !== undefined) patch.custom_path = customUrl.custom_path;

    if (Object.keys(patch).length) {
      await ncMeta
        .knexConnection(MetaTable.CUSTOM_URLS)
        .where('id', id)
        .update(patch);
    }
    return new CustomUrl({ id, ...customUrl });
  }

  public static async checkAvailability(
    _params: Partial<Pick<CustomUrl, 'id' | 'custom_path'>>,
    _ncMeta = Noco.ncMeta,
  ) {
    return false;
  }

  static async delete(
    customUrl: Partial<Pick<CustomUrl, 'id' | 'view_id' | 'fk_dashboard_id'>>,
    ncMeta = Noco.ncMeta,
  ): Promise<any> {
    if (customUrl.id) {
      await ncMeta
        .knexConnection(MetaTable.CUSTOM_URLS)
        .where('id', customUrl.id)
        .del();
      return { id: customUrl.id };
    }
    if (customUrl.view_id) {
      await ncMeta
        .knexConnection(MetaTable.CUSTOM_URLS)
        .where('view_id', customUrl.view_id)
        .del();
      return { view_id: customUrl.view_id };
    }
    if (customUrl.fk_dashboard_id) {
      await ncMeta
        .knexConnection(MetaTable.CUSTOM_URLS)
        .where('fk_dashboard_id', customUrl.fk_dashboard_id)
        .del();
      return { fk_dashboard_id: customUrl.fk_dashboard_id };
    }
  }

  static async bulkDelete(
    params: Partial<
      Pick<CustomUrl, 'fk_workspace_id' | 'base_id' | 'fk_model_id'>
    >,
    ncMeta = Noco.ncMeta,
  ): Promise<any> {
    let q = ncMeta.knexConnection(MetaTable.CUSTOM_URLS);
    if (params.fk_workspace_id) q = q.andWhere('fk_workspace_id', params.fk_workspace_id);
    if (params.base_id) q = q.andWhere('base_id', params.base_id);
    if (params.fk_model_id) q = q.andWhere('fk_model_id', params.fk_model_id);
    return q.del();
  }
}
