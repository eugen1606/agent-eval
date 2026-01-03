import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth() {
    return this.healthService.getHealth();
  }

  @Get('ready')
  async getReadiness(@Res() res: Response) {
    const status = await this.healthService.getReadiness();
    const httpStatus = status.status === 'healthy'
      ? HttpStatus.OK
      : HttpStatus.SERVICE_UNAVAILABLE;
    return res.status(httpStatus).json(status);
  }

  @Get('live')
  getLiveness() {
    return this.healthService.getLiveness();
  }
}
