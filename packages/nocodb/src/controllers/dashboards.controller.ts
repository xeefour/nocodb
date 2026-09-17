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
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { GlobalGuard } from '~/guards/global/global.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';
import Dashboard from '~/models/Dashboard';

// CE local-dev support for the EE-flavored frontend's dashboard feature.
// The frontend calls /api/v3/meta/bases/:baseId/dashboards/* for create,
// list, read, update, delete. The real CE source ships a no-op Dashboard
// model (so the routes return empty/null); this controller wires the
// routes to a working Dashboard implementation so dashboard records
// actually persist in nc_dashboards_v2.
//
// Widget layout, widget data fetch, dashboard sharing, and theme
// persistence are still stubs — only the dashboard CRUD itself is real.
@Controller(['/api/v3'])
@UseGuards(MetaApiLimiterGuard, AuthGuard('jwt'), GlobalGuard)
export class DashboardsController {
  @Get('/meta/bases/:baseId/dashboards')
  async listDashboards(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
  ) {
    const rows = await Dashboard.list(context, baseId);
    return { list: rows.map((r) => ({ ...r })) };
  }

  @Get('/meta/bases/:baseId/dashboards/:dashboardId')
  async getDashboard(
    @TenantContext() context: NcContext,
    @Param('baseId') _baseId: string,
    @Param('dashboardId') dashboardId: string,
  ) {
    const row = await Dashboard.get(context, dashboardId);
    if (!row) return null;
    return { ...row };
  }

  @Post('/meta/bases/:baseId/dashboards')
  async createDashboard(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Body() body: Partial<Dashboard>,
    @Req() req: NcRequest,
  ) {
    const row = await Dashboard.insert(context, baseId, {
      ...body,
      created_by: body?.created_by ?? req?.user?.id,
      owned_by: body?.owned_by ?? req?.user?.id,
    });
    return { ...row };
  }

  @Patch('/meta/bases/:baseId/dashboards/:dashboardId')
  async updateDashboard(
    @TenantContext() context: NcContext,
    @Param('baseId') _baseId: string,
    @Param('dashboardId') dashboardId: string,
    @Body() body: Partial<Dashboard>,
  ) {
    const row = await Dashboard.update(context, dashboardId, body);
    if (!row) return null;
    return { ...row };
  }

  @Delete('/meta/bases/:baseId/dashboards/:dashboardId')
  async deleteDashboard(
    @TenantContext() context: NcContext,
    @Param('baseId') _baseId: string,
    @Param('dashboardId') dashboardId: string,
  ) {
    await Dashboard.softDelete(context, dashboardId);
    return { success: true };
  }
}
