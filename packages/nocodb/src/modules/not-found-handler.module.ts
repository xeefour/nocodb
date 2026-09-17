import { Module } from '@nestjs/common';
import { ApiVersionNotFoundController } from '~/controllers/api-version-not-found.controller';
import { NotFoundV3Controller } from '~/controllers/v3/not-found-v3.controller';

// The EE-flavored frontend's catch-all 404 handling lives inside
// ApiVersionNotFoundController (it owns the `/api/v{1,2}/*` wildcards
// and therefore always wins the Express match against any unhandled
// sub-path). See the controller for the curated list of EE stub
// prefixes and the empty-shape responses it returns.
@Module({
  controllers: [NotFoundV3Controller, ApiVersionNotFoundController],
})
export class NotFoundHandlerModule {}
