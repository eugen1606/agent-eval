import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('BenchMark API')
    .setDescription(
      'AI Flow Evaluation API - Create tests, execute runs, and evaluate AI agent flows.\n\n' +
      '## Core Concepts\n' +
      '- **Test**: Reusable configuration defining what to evaluate (flowId, basePath, questionSet, settings)\n' +
      '- **Run**: Single execution of a test, containing results and status\n' +
      '- **Evaluation**: Human or LLM judgment of run results (correct/partial/incorrect)\n\n' +
      '## Authentication\n' +
      'This API uses cookie-based JWT authentication. Login via `/api/auth/login` to receive authentication cookies.'
    )
    .setVersion('1.0')
    .addCookieAuth('accessToken', {
      type: 'apiKey',
      in: 'cookie',
      name: 'accessToken',
    })
    .addTag('health', 'Health check endpoints')
    .addTag('auth', 'Authentication and user management')
    .addTag('tests', 'Test configuration management')
    .addTag('runs', 'Run execution and management')
    .addTag('questions', 'Question set management')
    .addTag('access-tokens', 'Encrypted access token storage')
    .addTag('flow-configs', 'Saved flow configurations (legacy)')
    .addTag('evaluations', 'Stored evaluation results (legacy)')
    .addTag('webhooks', 'Webhook management')
    .addTag('tags', 'Tag management')
    .addTag('scheduled-tests', 'Scheduled test management')
    .addTag('flow', 'Flow execution')
    .addTag('evaluation', 'LLM-as-judge evaluation')
    .addTag('export', 'Export/import functionality')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
    },
  });
}
