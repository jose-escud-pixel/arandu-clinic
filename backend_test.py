import requests
import sys
import json
from datetime import datetime, timedelta

class TraumaCareAPITester:
    def __init__(self, base_url="https://traumatology-hub.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.doctor_id = None
        self.patient_id = None
        self.appointment_id = None
        self.consultation_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, message, response_data=None):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}: PASSED - {message}")
        else:
            print(f"❌ {name}: FAILED - {message}")
            
        self.test_results.append({
            "test": name,
            "success": success,
            "message": message,
            "response": response_data
        })

    def make_request(self, method, endpoint, data=None, use_auth=False):
        """Make HTTP request with error handling"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if use_auth and self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            return response
        except requests.exceptions.RequestException as e:
            print(f"Request error: {str(e)}")
            return None

    def test_doctor_registration(self):
        """Test doctor registration"""
        timestamp = datetime.now().strftime('%H%M%S')
        email = f"test_doctor_{timestamp}@traumacare.com"
        name = f"Dr. Test {timestamp}"
        password = "TestPassword123!"

        data = {
            "email": email,
            "password": password,
            "name": name
        }

        response = self.make_request('POST', 'auth/register', data)
        
        if response and response.status_code == 200:
            result = response.json()
            if 'token' in result and 'doctor' in result:
                self.token = result['token']
                self.doctor_id = result['doctor']['id']
                self.log_test("Doctor Registration", True, f"Doctor {name} registered successfully")
                return True
            else:
                self.log_test("Doctor Registration", False, "Response missing token or doctor data", result)
        else:
            error_msg = f"HTTP {response.status_code if response else 'No response'}"
            if response:
                try:
                    error_details = response.json()
                    error_msg += f": {error_details.get('detail', 'Unknown error')}"
                except:
                    error_msg += f": {response.text}"
            self.log_test("Doctor Registration", False, error_msg)
        
        return False

    def test_doctor_login(self):
        """Test doctor login with existing credentials"""
        # Use the same credentials from registration
        timestamp = datetime.now().strftime('%H%M%S') 
        email = f"test_doctor_{timestamp}@traumacare.com"
        password = "TestPassword123!"

        data = {
            "email": email,
            "password": password
        }

        response = self.make_request('POST', 'auth/login', data)
        
        if response and response.status_code == 200:
            result = response.json()
            if 'token' in result:
                self.token = result['token']
                self.log_test("Doctor Login", True, "Login successful")
                return True
            else:
                self.log_test("Doctor Login", False, "No token in response", result)
        else:
            error_msg = f"HTTP {response.status_code if response else 'No response'}"
            if response:
                try:
                    error_details = response.json()
                    error_msg += f": {error_details.get('detail', 'Unknown error')}"
                except:
                    pass
            self.log_test("Doctor Login", False, error_msg)
        
        return False

    def test_get_doctor_info(self):
        """Test getting current doctor info"""
        response = self.make_request('GET', 'auth/me', use_auth=True)
        
        if response and response.status_code == 200:
            result = response.json()
            if 'id' in result and 'name' in result and 'email' in result:
                self.log_test("Get Doctor Info", True, f"Retrieved doctor info: {result['name']}")
                return True
            else:
                self.log_test("Get Doctor Info", False, "Incomplete doctor data", result)
        else:
            error_msg = f"HTTP {response.status_code if response else 'No response'}"
            self.log_test("Get Doctor Info", False, error_msg)
        
        return False

    def test_create_patient(self):
        """Test creating a new patient"""
        timestamp = datetime.now().strftime('%H%M%S')
        data = {
            "name": f"Juan Paciente {timestamp}",
            "age": 45,
            "cedula": f"12345{timestamp}",
            "address": "Calle Principal 123",
            "occupation": "Ingeniero",
            "phone": "+1234567890",
            "medical_history": "Fractura de muñeca en 2020. Cirugía exitosa."
        }

        response = self.make_request('POST', 'patients', data, use_auth=True)
        
        if response and response.status_code == 200:
            result = response.json()
            if 'id' in result and 'name' in result:
                self.patient_id = result['id']
                self.log_test("Create Patient", True, f"Patient {result['name']} created with ID: {self.patient_id}")
                return True
            else:
                self.log_test("Create Patient", False, "Incomplete patient data in response", result)
        else:
            error_msg = f"HTTP {response.status_code if response else 'No response'}"
            if response:
                try:
                    error_details = response.json()
                    error_msg += f": {error_details.get('detail', 'Unknown error')}"
                except:
                    pass
            self.log_test("Create Patient", False, error_msg)
        
        return False

    def test_get_patients(self):
        """Test getting all patients"""
        response = self.make_request('GET', 'patients', use_auth=True)
        
        if response and response.status_code == 200:
            result = response.json()
            if isinstance(result, list):
                self.log_test("Get All Patients", True, f"Retrieved {len(result)} patients")
                return True
            else:
                self.log_test("Get All Patients", False, "Response is not a list", result)
        else:
            error_msg = f"HTTP {response.status_code if response else 'No response'}"
            self.log_test("Get All Patients", False, error_msg)
        
        return False

    def test_get_patient_by_id(self):
        """Test getting a specific patient"""
        if not self.patient_id:
            self.log_test("Get Patient By ID", False, "No patient ID available")
            return False

        response = self.make_request('GET', f'patients/{self.patient_id}', use_auth=True)
        
        if response and response.status_code == 200:
            result = response.json()
            if 'id' in result and result['id'] == self.patient_id:
                self.log_test("Get Patient By ID", True, f"Retrieved patient: {result.get('name', 'Unknown')}")
                return True
            else:
                self.log_test("Get Patient By ID", False, "Patient data incomplete", result)
        else:
            error_msg = f"HTTP {response.status_code if response else 'No response'}"
            self.log_test("Get Patient By ID", False, error_msg)
        
        return False

    def test_update_patient(self):
        """Test updating patient information"""
        if not self.patient_id:
            self.log_test("Update Patient", False, "No patient ID available")
            return False

        data = {
            "phone": "+9876543210",
            "medical_history": "Fractura de muñeca en 2020. Cirugía exitosa. Revisión en 2025."
        }

        response = self.make_request('PUT', f'patients/{self.patient_id}', data, use_auth=True)
        
        if response and response.status_code == 200:
            result = response.json()
            if 'phone' in result and result['phone'] == data['phone']:
                self.log_test("Update Patient", True, "Patient updated successfully")
                return True
            else:
                self.log_test("Update Patient", False, "Update not reflected in response", result)
        else:
            error_msg = f"HTTP {response.status_code if response else 'No response'}"
            self.log_test("Update Patient", False, error_msg)
        
        return False

    def test_search_patients(self):
        """Test patient search"""
        search_query = "Juan"
        response = self.make_request('GET', f'patients/search?q={search_query}', use_auth=True)
        
        if response and response.status_code == 200:
            result = response.json()
            if isinstance(result, list):
                self.log_test("Search Patients", True, f"Search for '{search_query}' returned {len(result)} results")
                return True
            else:
                self.log_test("Search Patients", False, "Search response is not a list", result)
        else:
            error_msg = f"HTTP {response.status_code if response else 'No response'}"
            self.log_test("Search Patients", False, error_msg)
        
        return False

    def test_create_appointment(self):
        """Test creating an appointment"""
        if not self.patient_id:
            self.log_test("Create Appointment", False, "No patient ID available")
            return False

        future_date = datetime.now() + timedelta(days=7)
        data = {
            "patient_id": self.patient_id,
            "date": future_date.isoformat(),
            "reason": "Revisión de fractura",
            "notes": "Control post-quirúrgico"
        }

        response = self.make_request('POST', 'appointments', data, use_auth=True)
        
        if response and response.status_code == 200:
            result = response.json()
            if 'id' in result:
                self.appointment_id = result['id']
                self.log_test("Create Appointment", True, f"Appointment created with ID: {self.appointment_id}")
                return True
            else:
                self.log_test("Create Appointment", False, "No appointment ID in response", result)
        else:
            error_msg = f"HTTP {response.status_code if response else 'No response'}"
            if response:
                try:
                    error_details = response.json()
                    error_msg += f": {error_details.get('detail', 'Unknown error')}"
                except:
                    pass
            self.log_test("Create Appointment", False, error_msg)
        
        return False

    def test_get_appointments(self):
        """Test getting all appointments"""
        response = self.make_request('GET', 'appointments', use_auth=True)
        
        if response and response.status_code == 200:
            result = response.json()
            if isinstance(result, list):
                self.log_test("Get All Appointments", True, f"Retrieved {len(result)} appointments")
                return True
            else:
                self.log_test("Get All Appointments", False, "Response is not a list", result)
        else:
            error_msg = f"HTTP {response.status_code if response else 'No response'}"
            self.log_test("Get All Appointments", False, error_msg)
        
        return False

    def test_get_patient_appointments(self):
        """Test getting appointments for a specific patient"""
        if not self.patient_id:
            self.log_test("Get Patient Appointments", False, "No patient ID available")
            return False

        response = self.make_request('GET', f'patients/{self.patient_id}/appointments', use_auth=True)
        
        if response and response.status_code == 200:
            result = response.json()
            if isinstance(result, list):
                self.log_test("Get Patient Appointments", True, f"Retrieved {len(result)} appointments for patient")
                return True
            else:
                self.log_test("Get Patient Appointments", False, "Response is not a list", result)
        else:
            error_msg = f"HTTP {response.status_code if response else 'No response'}"
            self.log_test("Get Patient Appointments", False, error_msg)
        
        return False

    def test_create_consultation(self):
        """Test creating a consultation"""
        if not self.patient_id:
            self.log_test("Create Consultation", False, "No patient ID available")
            return False

        data = {
            "patient_id": self.patient_id,
            "diagnosis": "Evolución favorable post-fractura",
            "treatment": "Continuar fisioterapia 3x/semana",
            "notes": "Paciente refiere mejoría significativa. Rango de movimiento al 85%."
        }

        response = self.make_request('POST', 'consultations', data, use_auth=True)
        
        if response and response.status_code == 200:
            result = response.json()
            if 'id' in result:
                self.consultation_id = result['id']
                self.log_test("Create Consultation", True, f"Consultation created with ID: {self.consultation_id}")
                return True
            else:
                self.log_test("Create Consultation", False, "No consultation ID in response", result)
        else:
            error_msg = f"HTTP {response.status_code if response else 'No response'}"
            if response:
                try:
                    error_details = response.json()
                    error_msg += f": {error_details.get('detail', 'Unknown error')}"
                except:
                    pass
            self.log_test("Create Consultation", False, error_msg)
        
        return False

    def test_get_patient_consultations(self):
        """Test getting consultations for a specific patient"""
        if not self.patient_id:
            self.log_test("Get Patient Consultations", False, "No patient ID available")
            return False

        response = self.make_request('GET', f'patients/{self.patient_id}/consultations', use_auth=True)
        
        if response and response.status_code == 200:
            result = response.json()
            if isinstance(result, list):
                self.log_test("Get Patient Consultations", True, f"Retrieved {len(result)} consultations for patient")
                return True
            else:
                self.log_test("Get Patient Consultations", False, "Response is not a list", result)
        else:
            error_msg = f"HTTP {response.status_code if response else 'No response'}"
            self.log_test("Get Patient Consultations", False, error_msg)
        
        return False

    def test_dashboard_stats(self):
        """Test getting dashboard statistics"""
        response = self.make_request('GET', 'dashboard/stats', use_auth=True)
        
        if response and response.status_code == 200:
            result = response.json()
            required_fields = ['total_patients', 'appointments_today', 'active_treatments', 'pending_appointments']
            if all(field in result for field in required_fields):
                self.log_test("Dashboard Stats", True, f"Retrieved stats: {result}")
                return True
            else:
                self.log_test("Dashboard Stats", False, "Missing required fields in stats", result)
        else:
            error_msg = f"HTTP {response.status_code if response else 'No response'}"
            self.log_test("Dashboard Stats", False, error_msg)
        
        return False

    def test_file_upload(self):
        """Test file upload endpoint"""
        if not self.patient_id:
            self.log_test("File Upload", False, "No patient ID available")
            return False

        # Create a simple test file (base64 encoded image)
        test_file_content = b"Test file content for medical record"
        import base64
        file_data = base64.b64encode(test_file_content).decode('utf-8')
        
        # Simulate multipart form data for file upload
        import requests
        url = f"{self.api_url}/patients/{self.patient_id}/upload-file"
        headers = {'Authorization': f'Bearer {self.token}'}
        
        # Create a simple text file for testing
        files = {
            'file': ('test_radiografia.txt', test_file_content, 'text/plain')
        }
        
        try:
            response = requests.post(url, files=files, headers=headers, timeout=10)
            
            if response.status_code == 200:
                result = response.json()
                if 'id' in result and 'file_name' in result and 'file_url' in result:
                    self.log_test("File Upload", True, f"File uploaded successfully: {result['file_name']}")
                    return True
                else:
                    self.log_test("File Upload", False, "Incomplete file data in response", result)
            else:
                error_msg = f"HTTP {response.status_code}"
                try:
                    error_details = response.json()
                    error_msg += f": {error_details.get('detail', 'Unknown error')}"
                except:
                    error_msg += f": {response.text}"
                self.log_test("File Upload", False, error_msg)
        except Exception as e:
            self.log_test("File Upload", False, f"Request error: {str(e)}")
        
        return False

    def test_get_patient_files(self):
        """Test getting patient files"""
        if not self.patient_id:
            self.log_test("Get Patient Files", False, "No patient ID available")
            return False

        response = self.make_request('GET', f'patients/{self.patient_id}/files', use_auth=True)
        
        if response and response.status_code == 200:
            result = response.json()
            if isinstance(result, list):
                self.log_test("Get Patient Files", True, f"Retrieved {len(result)} files for patient")
                return True
            else:
                self.log_test("Get Patient Files", False, "Response is not a list", result)
        else:
            error_msg = f"HTTP {response.status_code if response else 'No response'}"
            self.log_test("Get Patient Files", False, error_msg)
        
        return False

    def test_export_patient_pdf(self):
        """Test PDF export functionality"""
        if not self.patient_id:
            self.log_test("Export Patient PDF", False, "No patient ID available")
            return False

        # Use requests directly for blob response
        import requests
        url = f"{self.api_url}/patients/{self.patient_id}/export-pdf"
        headers = {'Authorization': f'Bearer {self.token}'}
        
        try:
            response = requests.get(url, headers=headers, timeout=30)
            
            if response.status_code == 200:
                content_type = response.headers.get('content-type', '')
                if 'application/pdf' in content_type:
                    content_length = len(response.content)
                    self.log_test("Export Patient PDF", True, f"PDF generated successfully ({content_length} bytes)")
                    return True
                else:
                    self.log_test("Export Patient PDF", False, f"Invalid content type: {content_type}")
            else:
                error_msg = f"HTTP {response.status_code}"
                try:
                    error_details = response.json()
                    error_msg += f": {error_details.get('detail', 'Unknown error')}"
                except:
                    error_msg += f": {response.text[:100]}"
                self.log_test("Export Patient PDF", False, error_msg)
        except Exception as e:
            self.log_test("Export Patient PDF", False, f"Request error: {str(e)}")
        
        return False

    def test_upcoming_reminders(self):
        """Test upcoming reminders endpoint"""
        response = self.make_request('GET', 'appointments/upcoming-reminders', use_auth=True)
        
        if response and response.status_code == 200:
            result = response.json()
            if isinstance(result, list):
                self.log_test("Get Upcoming Reminders", True, f"Retrieved {len(result)} upcoming reminders")
                return True
            else:
                self.log_test("Get Upcoming Reminders", False, "Response is not a list", result)
        else:
            error_msg = f"HTTP {response.status_code if response else 'No response'}"
            self.log_test("Get Upcoming Reminders", False, error_msg)
        
        return False

    def test_create_reminder_appointment(self):
        """Test creating an appointment for tomorrow to test reminders"""
        if not self.patient_id:
            self.log_test("Create Reminder Appointment", False, "No patient ID available")
            return False

        # Create appointment for tomorrow
        tomorrow = datetime.now() + timedelta(days=1)
        tomorrow = tomorrow.replace(hour=14, minute=30, second=0, microsecond=0)  # Set specific time
        
        data = {
            "patient_id": self.patient_id,
            "date": tomorrow.isoformat(),
            "reason": "Consulta de control para recordatorio",
            "notes": "Cita para probar sistema de recordatorios"
        }

        response = self.make_request('POST', 'appointments', data, use_auth=True)
        
        if response and response.status_code == 200:
            result = response.json()
            if 'id' in result:
                self.log_test("Create Reminder Appointment", True, f"Tomorrow's appointment created for reminder test: {result['id']}")
                return True
            else:
                self.log_test("Create Reminder Appointment", False, "No appointment ID in response", result)
        else:
            error_msg = f"HTTP {response.status_code if response else 'No response'}"
            if response:
                try:
                    error_details = response.json()
                    error_msg += f": {error_details.get('detail', 'Unknown error')}"
                except:
                    pass
            self.log_test("Create Reminder Appointment", False, error_msg)
        
        return False

    def run_all_tests(self):
        """Run all API tests"""
        print("🩺 Starting TraumaCare API Testing...")
        print(f"🌐 Base URL: {self.base_url}")
        print("-" * 60)

        # Authentication Tests
        print("\n📋 AUTHENTICATION TESTS")
        self.test_doctor_registration()
        
        # Use existing token from registration for subsequent tests
        if not self.token:
            print("❌ Cannot proceed without authentication token")
            return False

        self.test_get_doctor_info()

        # Patient Management Tests
        print("\n👥 PATIENT MANAGEMENT TESTS")
        self.test_create_patient()
        self.test_get_patients()
        self.test_get_patient_by_id()
        self.test_update_patient()
        self.test_search_patients()

        # Appointment Tests
        print("\n📅 APPOINTMENT TESTS")
        self.test_create_appointment()
        self.test_get_appointments()
        self.test_get_patient_appointments()

        # Consultation Tests
        print("\n🩺 CONSULTATION TESTS")
        self.test_create_consultation()
        self.test_get_patient_consultations()

        # Dashboard Tests
        print("\n📊 DASHBOARD TESTS")
        self.test_dashboard_stats()

        # File Tests (NEW FEATURES)
        print("\n📁 FILE UPLOAD TESTS")
        self.test_file_upload()
        self.test_get_patient_files()
        
        # PDF Export Tests (NEW FEATURES)
        print("\n📄 PDF EXPORT TESTS")
        self.test_export_patient_pdf()
        
        # Reminder Tests (NEW FEATURES)
        print("\n🔔 REMINDER SYSTEM TESTS")
        self.test_create_reminder_appointment()
        self.test_upcoming_reminders()

        # Summary
        print("\n" + "="*60)
        print("🔍 TEST SUMMARY")
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")

        return self.tests_passed == self.tests_run

def main():
    tester = TraumaCareAPITester()
    success = tester.run_all_tests()
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())