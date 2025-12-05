import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';
import { Request, Response } from 'express';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockArgumentsHost: ArgumentsHost;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HttpExceptionFilter],
    }).compile();

    filter = module.get<HttpExceptionFilter>(HttpExceptionFilter);

    mockRequest = {
      url: '/api/test/endpoint',
      method: 'GET',
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
      getType: jest.fn(),
      getArgByIndex: jest.fn(),
      getArgs: jest.fn(),
      getClass: jest.fn(),
      getHandler: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
    } as any;
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  it('should handle HttpException with string message', () => {
    const exception = new HttpException('Test error message', HttpStatus.BAD_REQUEST);
    
    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'HTTP_EXCEPTION',
        message: 'Test error message',
        statusCode: HttpStatus.BAD_REQUEST,
      },
      timestamp: expect.any(String),
      path: '/api/test/endpoint',
    });
  });

  it('should handle HttpException with object response', () => {
    const exception = new HttpException(
      { message: 'Custom error', code: 'CUSTOM_ERROR' },
      HttpStatus.NOT_FOUND,
    );
    
    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'CUSTOM_ERROR',
        message: 'Custom error',
        statusCode: HttpStatus.NOT_FOUND,
      },
      timestamp: expect.any(String),
      path: '/api/test/endpoint',
    });
  });

  it('should handle generic Error', () => {
    const exception = new Error('Generic error message');
    
    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'Error',
        message: 'Generic error message',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      },
      timestamp: expect.any(String),
      path: '/api/test/endpoint',
    });
  });

  it('should handle unknown exception type', () => {
    const exception = { someProperty: 'unknown error' } as any;
    
    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      },
      timestamp: expect.any(String),
      path: '/api/test/endpoint',
    });
  });

  it('should extract path from request', () => {
    mockRequest.url = '/api/users/123';
    const exception = new HttpException('Not found', HttpStatus.NOT_FOUND);
    
    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/users/123',
      }),
    );
  });

  it('should include timestamp in ISO format', () => {
    const exception = new HttpException('Test', HttpStatus.BAD_REQUEST);
    
    filter.catch(exception, mockArgumentsHost);

    const callArgs = (mockResponse.json as jest.Mock).mock.calls[0][0];
    expect(callArgs.timestamp).toBeDefined();
    expect(typeof callArgs.timestamp).toBe('string');
    expect(() => new Date(callArgs.timestamp)).not.toThrow();
    expect(callArgs.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('should handle different HTTP status codes', () => {
    const statusCodes = [
      HttpStatus.BAD_REQUEST,
      HttpStatus.UNAUTHORIZED,
      HttpStatus.FORBIDDEN,
      HttpStatus.NOT_FOUND,
      HttpStatus.INTERNAL_SERVER_ERROR,
    ];

    statusCodes.forEach((statusCode) => {
      const exception = new HttpException('Error', statusCode);
      filter.catch(exception, mockArgumentsHost);
      
      expect(mockResponse.status).toHaveBeenCalledWith(statusCode);
      (mockResponse.json as jest.Mock).mockClear();
    });
  });

  it('should use exception name as code for generic Error', () => {
    class CustomError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'CustomError';
      }
    }

    const exception = new CustomError('Custom error');
    filter.catch(exception, mockArgumentsHost);

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'CustomError',
        }),
      }),
    );
  });
});
