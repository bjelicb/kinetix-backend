// Setup file for e2e tests
// This ensures NODE_ENV is set to 'test' before tests run
process.env.NODE_ENV = 'test';

// Ensure test database is used
if (!process.env.MONGODB_TEST_URI) {
  process.env.MONGODB_TEST_URI = 'mongodb://localhost:27017/kinetix_test';
}

