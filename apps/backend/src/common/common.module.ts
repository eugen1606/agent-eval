import { Global, Module } from '@nestjs/common';
import { UrlValidationService } from './validators/url-validation.service';
import { ProxyFetchService } from './proxy-fetch';

@Global()
@Module({
  providers: [UrlValidationService, ProxyFetchService],
  exports: [UrlValidationService, ProxyFetchService],
})
export class CommonModule {}
