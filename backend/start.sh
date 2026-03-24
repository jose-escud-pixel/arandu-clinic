
#!/bin/bash
cd /var/www/arandu-clinic/backend
source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8003
