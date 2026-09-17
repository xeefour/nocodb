import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { MetaTable } from '~/utils/globals';
import Noco from '~/Noco';

// CE stub: the EE `custom_url` feature is gated behind a paid plan in
// production, but the patched CE UI still calls its endpoints (e.g. the
// "copy share link" dialog asks the server "is this custom path free?").
// Back it with the existing nc_custom_urls table so the call resolves
// instead of 404-ing in the browser console.
@Controller(['/api/v2'])
@UseGuards(MetaApiLimiterGuard, AuthGuard('jwt'))
export class CustomUrlController {
  // `checkAvailability({ custom_path, id? })` → raw boolean.
  //
  // Returned as a bare boolean (not `{ available: true }`) on purpose:
  // the share-modal component reads the response with `J.value = e === !0`
  // (strict-equality against the boolean primitive) so an object response
  // always evaluates to false and the modal shows "unavailable" even for
  // paths the backend considers free. Anything other than the bare `true`
  // /`false` here breaks the share-form UX.
  //
  // "Available" means: no row in nc_custom_urls owns this custom_path,
  // OR the row that owns it is the one being edited (`id` matches the
  // row's primary key, so renaming to the same value is allowed).
  @Post('/meta/custom-url/check-path')
  async checkAvailability(@Body() body: any) {
    const customPath = (body?.custom_path ?? '').toString().trim();

    if (!customPath) {
      // Empty path is always invalid; let the frontend flag it.
      return false;
    }

    let q = Noco.ncMeta
      .knexConnection(MetaTable.CUSTOM_URLS)
      .where('custom_path', customPath);

    // `id` (and the legacy `exclude_id` from older frontends) is the
    // custom_url row being edited — that row is allowed to "own" the
    // path we're checking, otherwise renaming to its current value
    // would falsely report "taken".
    const excludeId =
      (body?.id ?? body?.exclude_id ?? '').toString().trim();
    if (excludeId) q = q.andWhereNot('id', excludeId);

    const conflict = await q.first();
    return !conflict;
  }

  @Get('/meta/custom-url/get-by-id/:id')
  async getById(@Param('id') id: string) {
    const row = await Noco.ncMeta
      .knexConnection(MetaTable.CUSTOM_URLS)
      .where('id', id)
      .first();
    if (!row) return { error: 'Custom URL not found' };
    return row;
  }
}
