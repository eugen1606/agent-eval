import { Global, Module } from '@nestjs/common';
import { UrlValidationService } from './validators/url-validation.service';

@Global()
@Module({
  providers: [UrlValidationService],
  exports: [UrlValidationService],
})
export class CommonModule {}
