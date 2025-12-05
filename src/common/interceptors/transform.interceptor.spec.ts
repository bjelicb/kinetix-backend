import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor;
  let executionContext: ExecutionContext;
  let callHandler: CallHandler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TransformInterceptor],
    }).compile();

    interceptor = module.get<TransformInterceptor>(TransformInterceptor);

    // Mock ExecutionContext
    executionContext = {
      switchToHttp: jest.fn(),
      getClass: jest.fn(),
      getHandler: jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    } as any;

    // Mock CallHandler
    callHandler = {
      handle: jest.fn(),
    } as any;
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should transform response to standard format', (done) => {
    const testData = { id: '123', name: 'Test' };
    (callHandler.handle as jest.Mock).mockReturnValue(of(testData));

    interceptor.intercept(executionContext, callHandler).subscribe((result) => {
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('timestamp');
      expect(result.success).toBe(true);
      expect(result.data).toEqual(testData);
      expect(typeof result.timestamp).toBe('string');
      expect(() => new Date(result.timestamp)).not.toThrow(); // Valid ISO string
      done();
    });
  });

  it('should include timestamp in ISO format', (done) => {
    const testData = { message: 'Hello' };
    (callHandler.handle as jest.Mock).mockReturnValue(of(testData));

    interceptor.intercept(executionContext, callHandler).subscribe((result) => {
      const timestamp = new Date(result.timestamp);
      expect(timestamp.getTime()).not.toBeNaN();
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      done();
    });
  });

  it('should preserve data structure', (done) => {
    const complexData = {
      user: { id: '1', name: 'John' },
      items: [{ id: '1', value: 10 }],
    };
    (callHandler.handle as jest.Mock).mockReturnValue(of(complexData));

    interceptor.intercept(executionContext, callHandler).subscribe((result) => {
      expect(result.data).toEqual(complexData);
      expect(result.data.user).toEqual(complexData.user);
      expect(result.data.items).toEqual(complexData.items);
      done();
    });
  });

  it('should handle null data', (done) => {
    (callHandler.handle as jest.Mock).mockReturnValue(of(null));

    interceptor.intercept(executionContext, callHandler).subscribe((result) => {
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
      expect(result).toHaveProperty('timestamp');
      done();
    });
  });

  it('should handle array data', (done) => {
    const arrayData = [{ id: '1' }, { id: '2' }];
    (callHandler.handle as jest.Mock).mockReturnValue(of(arrayData));

    interceptor.intercept(executionContext, callHandler).subscribe((result) => {
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBe(2);
      done();
    });
  });
});
