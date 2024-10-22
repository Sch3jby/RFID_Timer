# Dockerfile for the backend
FROM python:3.9

# Set the working directory
WORKDIR /app

# Copy requirements.txt and install dependencies
COPY requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

EXPOSE 5001

# Command to run the application
CMD ["python", "app.py"]
