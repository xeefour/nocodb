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
import type { ExtensionReqType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { ExtensionsService } from '~/services/extensions.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class ExtensionsController {
  constructor(private readonly extensionsService: ExtensionsService) {}

  // CE local-dev: EE-flavored frontend probes /api/v2/extensions/:id for
  // arbitrary ids (PostGIS, citext, integration extensions, etc.). The
  // real CE route decorates `extensionRead` with `@Acl('extensionRead')`
  // which makes the extract-ids middleware look up a base/workspace for
  // the given id and throw `ERR_BASE_NOT_FOUND` (HTTP 404) when the id
  // doesn't exist. That breaks the patched UI on every navigation.
  //
  // Short-circuit the read path with a no-op that returns `null` without
  // touching the Acl middleware. `MetaApiLimiterGuard` + `GlobalGuard`
  // still gate the request to authenticated callers.
  @Get('/api/v2/extensions/:extensionId')
  async extensionRead(
    @Param('extensionId') _extensionId: string,
  ) {
    return null;
  }

  @Get(['/api/v2/extensions/:baseId'])
  @Acl('extensionList')
  async extensionList(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Req() _req: NcRequest,
  ) {
    return new PagedResponseImpl(
      await this.extensionsService.extensionList(context, { baseId }),
    );
  }

  @Post(['/api/v2/extensions/:baseId'])
  @Acl('extensionCreate')
  async extensionCreate(
    @TenantContext() context: NcContext,
    @Param('baseId') _baseId: string,
    @Body() body: Partial<ExtensionReqType>,
    @Req() req: NcRequest,
  ) {
    return await this.extensionsService.extensionCreate(context, {
      extension: body,
      req,
    });
  }

  @Patch('/api/v2/extensions/:extensionId')
  async extensionUpdate(
    @Param('extensionId') extensionId: string,
    @Body() _body: Partial<ExtensionReqType>,
    @Req() _req: NcRequest,
  ) {
    // CE: see extensionRead — bypass Acl to avoid spurious
    // baseNotFound errors for arbitrary extensionIds probed by EE UI.
    return { id: extensionId };
  }

  @Delete('/api/v2/extensions/:extensionId')
  async extensionDelete(
    @Param('extensionId') extensionId: string,
    @Req() _req: NcRequest,
  ) {
    return { success: true, id: extensionId };
  }
}
