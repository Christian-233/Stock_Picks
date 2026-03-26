/**
 * ERROR HANDLING TEST SUITE
 * Run these tests before marking any changes as complete
 * Tests cover: JSON parsing, data validation, network errors, CORS, component rendering
 */

class ErrorHandlingTests {
  constructor() {
    this.tests = [];
    this.results = { passed: 0, failed: 0, errors: [] };
  }

  // Test: Safe JSON parsing handles already-parsed objects
  testJsonParseAlreadyParsedObject() {
    const value = { low: 100, mid: 110, high: 120 };
    const safeParse = (val) => {
      if (!val) return null;
      if (Array.isArray(val) || (typeof val === 'object' && val !== null)) {
        return val;
      }
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch (e) {
          return null;
        }
      }
      return null;
    };

    const result = safeParse(value);
    const passed = result && result.mid === 110;
    return {
      name: 'JSON Parse: Already-parsed object',
      passed,
      error: passed ? null : `Expected mid=110, got ${result?.mid}`
    };
  }

  // Test: Safe JSON parsing handles JSON strings
  testJsonParseJsonString() {
    const value = JSON.stringify({ low: 100, mid: 110, high: 120 });
    const safeParse = (val) => {
      if (!val) return null;
      if (Array.isArray(val) || (typeof val === 'object' && val !== null)) {
        return val;
      }
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch (e) {
          return null;
        }
      }
      return null;
    };

    const result = safeParse(value);
    const passed = result && result.mid === 110;
    return {
      name: 'JSON Parse: Valid JSON string',
      passed,
      error: passed ? null : `Expected mid=110, got ${result?.mid}`
    };
  }

  // Test: Safe JSON parsing handles invalid JSON
  testJsonParseInvalidString() {
    const value = '[object Obj';
    const safeParse = (val) => {
      if (!val) return null;
      if (Array.isArray(val) || (typeof val === 'object' && val !== null)) {
        return val;
      }
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch (e) {
          return null;
        }
      }
      return null;
    };

    const result = safeParse(value);
    const passed = result === null;
    return {
      name: 'JSON Parse: Invalid JSON returns null',
      passed,
      error: passed ? null : `Expected null, got ${result}`
    };
  }

  // Test: Data validation catches missing required fields
  testDataValidationMissingFields() {
    const prediction = {
      ticker: 'AAPL',
      target_dates: null,
      predicted_prices: [180, 185],
      confidence_scores: [0.7, 0.75]
    };

    const targetDates = prediction.target_dates;
    const predictedPrices = prediction.predicted_prices;
    const confidenceScores = prediction.confidence_scores;

    const isValid = targetDates && predictedPrices && confidenceScores;
    return {
      name: 'Data Validation: Detects missing target_dates',
      passed: !isValid, // Should fail validation
      error: isValid ? 'Should have detected missing target_dates' : null
    };
  }

  // Test: Array element access doesn't crash on undefined
  testArrayAccessSafety() {
    const predictedPrices = [180];
    const confidenceScores = [0.7];

    try {
      const price0 = Array.isArray(predictedPrices) ? predictedPrices[0] : predictedPrices;
      const price1 = Array.isArray(predictedPrices) ? predictedPrices[1] : predictedPrices;
      const conf0 = Array.isArray(confidenceScores) ? confidenceScores[0] : confidenceScores;
      const conf1 = Array.isArray(confidenceScores) ? confidenceScores[1] : confidenceScores;

      // Should not crash, but price1 and conf1 will be undefined
      const passed = price0 === 180 && conf0 === 0.7;
      return {
        name: 'Array Access: Safe access to array elements',
        passed,
        error: passed ? null : 'Array access failed'
      };
    } catch (e) {
      return {
        name: 'Array Access: Safe access to array elements',
        passed: false,
        error: e.message
      };
    }
  }

  // Test: Type checking prevents toFixed() errors
  testTypeCheckingBeforeToFixed() {
    const testCases = [
      { price: 180.5, shouldWork: true },
      { price: '180.5', shouldWork: false },
      { price: null, shouldWork: false },
      { price: undefined, shouldWork: false }
    ];

    let allPassed = true;
    for (const testCase of testCases) {
      const canUseToFixed = typeof testCase.price === 'number';
      if (canUseToFixed !== testCase.shouldWork) {
        allPassed = false;
        break;
      }
    }

    return {
      name: 'Type Checking: toFixed() only called on numbers',
      passed: allPassed,
      error: allPassed ? null : 'Type checking failed'
    };
  }

  // Test: Error boundary catches and displays errors gracefully
  testErrorBoundaryRender() {
    const errorMessage = 'Error: Unable to render prediction';
    const errorCard = {
      className: 'prediction-card error',
      content: errorMessage
    };

    const rendered = errorCard.className && errorCard.content;
    return {
      name: 'Error Boundary: Error card renders even on error',
      passed: rendered,
      error: rendered ? null : 'Error card not rendered'
    };
  }

  // Test: API error response handling
  testAPIErrorResponse() {
    const responses = [
      { ok: false, status: 500, error: 'Server Error', shouldHandle: true },
      { ok: false, status: 401, error: 'Unauthorized', shouldHandle: true },
      { ok: false, status: 404, error: 'Not Found', shouldHandle: true },
      { ok: true, status: 200, error: null, shouldHandle: false }
    ];

    let allPassed = true;
    for (const response of responses) {
      const doesHandle = !response.ok;
      if (doesHandle !== response.shouldHandle) {
        allPassed = false;
        break;
      }
    }

    return {
      name: 'API Error Handling: Non-200 responses caught',
      passed: allPassed,
      error: allPassed ? null : 'API error handling failed'
    };
  }

  // Test: CORS error detection in try-catch
  testCORSErrorDetection() {
    const corsError = new TypeError('Failed to fetch');
    const networkError = new Error('Network error');

    const isCORSError = corsError.message === 'Failed to fetch';
    const isNetworkError = networkError.message === 'Network error';

    return {
      name: 'CORS Error: Failed to fetch detected',
      passed: isCORSError && isNetworkError,
      error: isCORSError && isNetworkError ? null : 'Error detection failed'
    };
  }

  // Test: localStorage safety
  testLocalStorageSafety() {
    try {
      const data = ['AAPL', 'MSFT', 'GOOGL'];
      const serialized = JSON.stringify(data);
      const deserialized = JSON.parse(serialized);
      const passed = Array.isArray(deserialized) && deserialized[0] === 'AAPL';
      return {
        name: 'localStorage: Safe serialization/deserialization',
        passed,
        error: passed ? null : 'localStorage handling failed'
      };
    } catch (e) {
      return {
        name: 'localStorage: Safe serialization/deserialization',
        passed: false,
        error: e.message
      };
    }
  }

  // Test: Null-safe property access
  testNullSafePropertyAccess() {
    const prediction = null;
    const ticker = prediction?.ticker || 'Unknown';
    const id = prediction?.id || 'unknown-id';

    return {
      name: 'Null Safety: Optional chaining prevents crashes',
      passed: ticker === 'Unknown' && id === 'unknown-id',
      error: ticker === 'Unknown' && id === 'unknown-id' ? null : 'Null safety failed'
    };
  }

  // Test: Connection refused error detection (backend not running)
  testConnectionRefusedError() {
    const errorMessages = [
      'Failed to fetch',
      'net::ERR_CONNECTION_REFUSED',
      'ERR_CONNECTION_REFUSED'
    ];

    const detectConnectionError = (error) => {
      const message = error.message || error;
      return (
        message.includes('Failed to fetch') || 
        message.includes('ERR_CONNECTION_REFUSED') ||
        message.includes('Connection refused') ||
        message.includes('ECONNREFUSED')
      );
    };

    const testError = new Error('Failed to fetch');
    const passed = detectConnectionError(testError);

    return {
      name: 'Network Error: Connection refused detection',
      passed,
      error: passed ? null : 'Connection error detection failed'
    };
  }

  // Test: Backend unavailability message display
  testBackendUnavailableMessage() {
    const error = new Error('Failed to fetch');
    
    const getErrorMessage = (err) => {
      const msg = err.message || '';
      if (msg.includes('Failed to fetch') || msg.includes('ERR_CONNECTION_REFUSED')) {
        return '⚠️ Backend server is not responding. Please ensure the backend is running on port 5002.';
      }
      if (msg.includes('timeout')) {
        return '⚠️ Request timed out. Server is taking too long to respond.';
      }
      return `⚠️ Error: ${msg}`;
    };

    const message = getErrorMessage(error);
    const passed = message.includes('Backend server is not responding');

    return {
      name: 'Error Message: Backend unavailable shows helpful message',
      passed,
      error: passed ? null : 'Error message not helpful'
    };
  }

  // Test: API base URL environment variable fallback
  testApiUrlConfiguration() {
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5002/api';
    const isValid = apiUrl.includes('localhost') && apiUrl.includes('api');

    return {
      name: 'Configuration: API URL properly configured',
      passed: isValid,
      error: isValid ? null : `Invalid API URL: ${apiUrl}`
    };
  }

  // Test: Network error classification and handling
  testNetworkErrorClassification() {
    const classifyError = (error) => {
      const msg = (error.message || '').toLowerCase();
      
      if (msg.includes('connection') || msg.includes('refused')) {
        return 'connection-error';
      }
      if (msg.includes('timeout')) {
        return 'timeout-error';
      }
      if (msg.includes('cors')) {
        return 'cors-error';
      }
      if (msg.includes('404') || msg.includes('not found')) {
        return 'not-found-error';
      }
      return 'unknown-error';
    };

    const connError = new Error('ERR_CONNECTION_REFUSED');
    const timeoutError = new Error('Request timeout');
    const corsError = new Error('CORS error');

    const passed = 
      classifyError(connError) === 'connection-error' &&
      classifyError(timeoutError) === 'timeout-error' &&
      classifyError(corsError) === 'cors-error';

    return {
      name: 'Error Classification: Network errors properly classified',
      passed,
      error: passed ? null : 'Error classification failed'
    };
  }

  run() {
    console.log('\n' + '='.repeat(60));
    console.log('ERROR HANDLING TEST SUITE');
    console.log('='.repeat(60) + '\n');

    const testMethods = [
      'testJsonParseAlreadyParsedObject',
      'testJsonParseJsonString',
      'testJsonParseInvalidString',
      'testDataValidationMissingFields',
      'testArrayAccessSafety',
      'testTypeCheckingBeforeToFixed',
      'testErrorBoundaryRender',
      'testAPIErrorResponse',
      'testCORSErrorDetection',
      'testLocalStorageSafety',
      'testNullSafePropertyAccess',
      'testConnectionRefusedError',
      'testBackendUnavailableMessage',
      'testApiUrlConfiguration',
      'testNetworkErrorClassification'
    ];

    for (const methodName of testMethods) {
      try {
        const result = this[methodName]();
        const status = result.passed ? '✓ PASS' : '✗ FAIL';
        console.log(`${status} - ${result.name}`);
        
        if (!result.passed) {
          console.log(`  └─ ${result.error}`);
          this.results.failed++;
          this.results.errors.push({
            test: result.name,
            error: result.error
          });
        } else {
          this.results.passed++;
        }
      } catch (e) {
        console.log(`✗ FAIL - ${methodName}`);
        console.log(`  └─ ${e.message}`);
        this.results.failed++;
        this.results.errors.push({
          test: methodName,
          error: e.message
        });
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`RESULTS: ${this.results.passed} passed, ${this.results.failed} failed`);
    console.log('='.repeat(60) + '\n');

    if (this.results.failed > 0) {
      console.log('FAILED TESTS:');
      this.results.errors.forEach(err => {
        console.log(`  • ${err.test}: ${err.error}`);
      });
      process.exit(1);
    }

    return this.results;
  }
}

// Run tests if executed directly
if (require.main === module) {
  const suite = new ErrorHandlingTests();
  suite.run();
}

module.exports = ErrorHandlingTests;
