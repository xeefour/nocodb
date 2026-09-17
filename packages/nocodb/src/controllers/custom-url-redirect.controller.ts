import {
  Controller,
  Get,
  Param,
  Req,
  Res,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { MetaTable } from '~/utils/globals';
import Noco from '~/Noco';

// Public redirect for shared URLs created via the "Custom URL" feature.
//
// Browser flow:
//   1. Owner enables "Enable public viewing" on a base/view, types a
//      custom path ("team"), saves.
//   2. Owner shares the URL `https://host/p/team`.
//   3. Visitor hits `/p/team` → this handler looks up `nc_custom_urls`,
//      finds the row whose `custom_path` matches, and 302s to
//      `original_path` (e.g. `/nc/view/<viewId>` or `/nc/form/<viewId>`).
//
// In CE the EE billing / licensing layer that actually creates rows is
// absent, but the EE-flavoured frontend still inserts them through the
// CustomUrlController I added (and any direct DB writes the user makes
// for testing). This stub just makes the public redirect side work.
@Controller()
export class CustomUrlRedirectController {
  @Get('/p/:customPath')
  async redirect(
    @Param('customPath') customPath: string,
    @Req() _req: Request,
    @Res() res: Response,
  ) {
    const trimmed = (customPath ?? '').trim();
    if (!trimmed) {
      res.status(404).json({ msg: 'Cannot GET /p/' });
      return;
    }

    const row = await Noco.ncMeta
      .knexConnection(MetaTable.CUSTOM_URLS)
      .where('custom_path', trimmed)
      .first();

    if (!row || !row.original_path) {
      res.status(404).json({ msg: `Cannot GET /p/${trimmed}` });
      return;
    }

    // 302 redirect to the actual share URL. Express normalises
    // relative paths so `/nc/view/...` resolves against the current
    // host automatically.
    res.redirect(302, row.original_path);
  }
}
