import threading
import logging
import time
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from azure_cost_optimizer.optimizer import main as optimizer_main

# Initialize Flask app
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Initialize logger
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
handler.setFormatter(formatter)
logger.addHandler(handler)

# Global variables to store the data
summary_metrics_data = []
execution_data_data = []
impacted_resources_data = []
optimizer_status = "Idle"  # Track optimizer status
anomalies_data = []  # Global variable to store anomalies
trend_data = []  # Global variable to store trend data
log_messages = []  # Store log messages for SSE

def stream_logs():
    """Generator function to stream log messages."""
    global log_messages
    while True:
        if log_messages:
            message = log_messages.pop(0)
            yield f'data: {message}\n\n'
        time.sleep(1)

# Custom log handler to store log messages
class SSELogHandler(logging.Handler):
    def emit(self, record):
        global log_messages
        log_messages.append(self.format(record))

sse_handler = SSELogHandler()
sse_handler.setFormatter(formatter)
logger.addHandler(sse_handler)

@app.route('/api/log-stream')
def log_stream():
    return Response(stream_logs(), content_type='text/event-stream')

@app.route('/api/run', methods=['POST'])
def run_optimizer():
    global optimizer_status
    mode = request.json.get('mode')
    all_subscriptions = request.json.get('all_subscriptions', False)
    timeout = request.json.get('timeout', 3600)  # Default to 1 hour timeout if not specified

    def run_optimizer_in_thread():
        global summary_metrics_data, execution_data_data, impacted_resources_data, anomalies_data, trend_data, optimizer_status
        optimizer_status = "Running"
        start_time = time.time()
        try:
            result = optimizer_main(mode=mode, all_subscriptions=all_subscriptions)
            while time.time() - start_time < timeout:
                result = optimizer_main(mode=mode, all_subscriptions=all_subscriptions)
                if result is None:
                    raise ValueError("optimizer_main returned None")
                summary_metrics_data = result['summary_reports']
                execution_data_data = result['status_log']
                impacted_resources_data = result['impacted_resources']
                trend_data = result['trend_data']
                anomalies_data = result['anomalies']
                optimizer_status = "Completed"
                return
            optimizer_status = "Timeout"
            logger.error("Optimizer timeout")
        except Exception as e:
            optimizer_status = f"Error: {str(e)}"
            logger.error(f"Optimizer error: {e}")

    thread = threading.Thread(target=run_optimizer_in_thread)
    thread.start()

    return jsonify({'status': 'Optimizer started'}), 200

# Route to get optimizer status
@app.route('/api/status', methods=['GET'])
def get_status():
    return jsonify({'status': optimizer_status}), 200
# Route to get summary metrics
@app.route('/api/summary-metrics', methods=['GET'])
def get_summary_metrics():
    try:
        return jsonify(summary_metrics_data), 200
    except Exception as e:
        logger.error(f"Error fetching summary metrics: {e}")
        return jsonify({'error': 'Error fetching summary metrics'}), 500
# Route to get execution data
@app.route('/api/execution-data', methods=['GET'])
def get_execution_data():
    try:
        logger.info("Returning Execution Data")
        return jsonify(execution_data_data), 200
    except Exception as e:
        logger.error(f"Error fetching execution data: {e}")
        return jsonify({'error': 'Error fetching execution data'}), 500

# Route to get impacted resources
@app.route('/api/impacted-resources', methods=['GET'])
def get_impacted_resources():
    try:
        logger.info("Returning Impacted Resources Data")
        return jsonify(impacted_resources_data), 200
    except Exception as e:
        logger.error(f"Error fetching impacted resources: {e}")
        return jsonify({'error': 'Error fetching impacted resources'}), 500

@app.route('/api/trend-data', methods=['GET'])
def get_trend_data():
    try:
        return jsonify(trend_data), 200
    except Exception as e:
        logger.error(f"Error fetching trend data: {e}")
        return jsonify({'error': 'Error fetching trend data'}), 500

@app.route('/api/anomalies', methods=['GET'])
def get_anomalies():
    try:
        return jsonify(anomalies_data), 200
    except Exception as e:
        logger.error(f"Error fetching anomalies data: {e}")
        return jsonify({'error': 'Error fetching anomalies data'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
