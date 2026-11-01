import {
  ArgumentsHost,
  Catch,
  ConflictException,
  HttpException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '../../generated/prisma/client.js';

/**
 * Traduce los errores conocidos de Prisma a respuestas HTTP. Los servicios
 * validan antes de escribir; este filtro cubre las carreras que solo detecta
 * la base de datos (unicidad, registros eliminados entre lectura y escritura).
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(error: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    super.catch(this.toHttp(error), host);
  }

  private toHttp(
    error: Prisma.PrismaClientKnownRequestError,
  ): HttpException | Error {
    switch (error.code) {
      case 'P2002':
        return new ConflictException('Ya existe un registro con esos datos');
      case 'P2025':
        return new NotFoundException('Registro no encontrado');
      case 'P2034':
        return concurrentConflict();
      case 'P2010':
        // Consulta SQL propia abortada por un interbloqueo o una serialización.
        if (['40P01', '40001'].includes(String(error.meta?.code)))
          return concurrentConflict();
        this.logger.error(`Error de Prisma ${error.code}`, error.stack);
        return error;
      case 'P2003':
        return new ConflictException(
          'La operación no es posible porque hay registros relacionados',
        );
      default:
        this.logger.error(`Error de Prisma ${error.code}`, error.stack);
        return error;
    }
  }
}

const concurrentConflict = () =>
  new ConflictException(
    'La operación coincidió con otra al mismo tiempo. Intente de nuevo.',
  );
