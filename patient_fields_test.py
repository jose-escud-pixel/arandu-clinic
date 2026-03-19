import requests
import sys
import uuid
from datetime import datetime

class PatientNewFieldsTester:
    def __init__(self, base_url="https://arandu-paciente-docs.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.patient_id = None

    def log_test(self, test_name, success, details=""):
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {test_name} - PASSED")
        else:
            print(f"❌ {test_name} - FAILED: {details}")
        
        if details and success:
            print(f"   ℹ️ {details}")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            
            if success:
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"   Expected: {expected_status}, Got: {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Response: {error_data}")
                except:
                    print(f"   Response: {response.text[:200]}")
                return False, {}

        except Exception as e:
            print(f"   Exception: {str(e)}")
            return False, {}

    def register_test_doctor(self):
        """Register a test doctor for authentication"""
        unique_id = str(uuid.uuid4())[:8]
        test_email = f"testdoctor_{unique_id}@arandu.com"
        
        success, response = self.run_test(
            "Register Test Doctor",
            "POST",
            "api/auth/register",
            200,
            data={
                "email": test_email,
                "password": "TestPass123!",
                "name": f"Dr. Test {unique_id}"
            }
        )
        
        self.log_test("Doctor Registration", success, f"Email: {test_email}")
        
        if success and 'token' in response:
            self.token = response['token']
            return True
        return False

    def test_patient_creation_with_new_fields(self):
        """Test creating a patient with the new fields: nationality, insurance_name, insurance_number"""
        test_patient = {
            "name": "María González Test",
            "age": 35,
            "cedula": "12345678",
            "nationality": "Paraguaya",
            "address": "Av. España 123",
            "occupation": "Ingeniera",
            "phone": "0981-123456", 
            "insurance_name": "IPS",
            "insurance_number": "IPS-789456",
            "medical_history": "Sin antecedentes relevantes"
        }
        
        success, response = self.run_test(
            "Create Patient with New Fields",
            "POST",
            "api/patients",
            200,
            data=test_patient
        )
        
        if success and 'id' in response:
            self.patient_id = response['id']
            # Check if new fields are in the response
            has_nationality = response.get('nationality') == test_patient['nationality']
            has_insurance_name = response.get('insurance_name') == test_patient['insurance_name'] 
            has_insurance_number = response.get('insurance_number') == test_patient['insurance_number']
            
            all_fields_present = has_nationality and has_insurance_name and has_insurance_number
            details = f"nationality: {response.get('nationality')}, insurance_name: {response.get('insurance_name')}, insurance_number: {response.get('insurance_number')}"
            
            self.log_test("Patient Creation with New Fields", all_fields_present, details)
            return all_fields_present
        else:
            self.log_test("Patient Creation with New Fields", False, "Failed to create patient")
            return False

    def test_patient_retrieval_with_new_fields(self):
        """Test retrieving a patient and verify new fields are returned"""
        if not self.patient_id:
            self.log_test("Patient Retrieval", False, "No patient ID available")
            return False
            
        success, response = self.run_test(
            "Get Patient Detail",
            "GET",
            f"api/patients/{self.patient_id}",
            200
        )
        
        if success:
            has_nationality = 'nationality' in response and response['nationality'] == "Paraguaya"
            has_insurance_name = 'insurance_name' in response and response['insurance_name'] == "IPS"
            has_insurance_number = 'insurance_number' in response and response['insurance_number'] == "IPS-789456"
            
            all_fields_present = has_nationality and has_insurance_name and has_insurance_number
            details = f"Retrieved fields - nationality: {response.get('nationality')}, insurance_name: {response.get('insurance_name')}, insurance_number: {response.get('insurance_number')}"
            
            self.log_test("Patient Retrieval with New Fields", all_fields_present, details)
            return all_fields_present
        else:
            self.log_test("Patient Retrieval with New Fields", False, "Failed to retrieve patient")
            return False

    def test_patient_update_with_new_fields(self):
        """Test updating a patient's new fields"""
        if not self.patient_id:
            self.log_test("Patient Update", False, "No patient ID available")
            return False

        update_data = {
            "nationality": "Argentina",
            "insurance_name": "Asismed",
            "insurance_number": "ASIS-456789"
        }
        
        success, response = self.run_test(
            "Update Patient Fields",
            "PUT",
            f"api/patients/{self.patient_id}",
            200,
            data=update_data
        )
        
        if success:
            has_nationality = response.get('nationality') == update_data['nationality']
            has_insurance_name = response.get('insurance_name') == update_data['insurance_name']
            has_insurance_number = response.get('insurance_number') == update_data['insurance_number']
            
            all_fields_updated = has_nationality and has_insurance_name and has_insurance_number
            details = f"Updated fields - nationality: {response.get('nationality')}, insurance_name: {response.get('insurance_name')}, insurance_number: {response.get('insurance_number')}"
            
            self.log_test("Patient Update with New Fields", all_fields_updated, details)
            return all_fields_updated
        else:
            self.log_test("Patient Update with New Fields", False, "Failed to update patient")
            return False

    def test_patient_listing_includes_new_fields(self):
        """Test that patient listing includes new fields"""
        success, response = self.run_test(
            "List All Patients",
            "GET",
            "api/patients",
            200
        )
        
        if success and isinstance(response, list) and len(response) > 0:
            # Find our test patient
            test_patient = None
            for patient in response:
                if patient.get('id') == self.patient_id:
                    test_patient = patient
                    break
            
            if test_patient:
                has_nationality = 'nationality' in test_patient
                has_insurance_name = 'insurance_name' in test_patient
                has_insurance_number = 'insurance_number' in test_patient
                
                all_fields_in_list = has_nationality and has_insurance_name and has_insurance_number
                details = f"Fields in list - nationality: {test_patient.get('nationality')}, insurance_name: {test_patient.get('insurance_name')}, insurance_number: {test_patient.get('insurance_number')}"
                
                self.log_test("Patient List Contains New Fields", all_fields_in_list, details)
                return all_fields_in_list
            else:
                self.log_test("Patient List Contains New Fields", False, "Test patient not found in list")
                return False
        else:
            self.log_test("Patient List Contains New Fields", False, "Failed to retrieve patients list")
            return False

    def test_dashboard_stats(self):
        """Test dashboard stats endpoint"""
        success, response = self.run_test(
            "Dashboard Stats",
            "GET",
            "api/dashboard/stats",
            200
        )
        
        if success:
            required_fields = ['total_patients', 'appointments_today', 'active_treatments', 'pending_appointments']
            has_all_fields = all(field in response for field in required_fields)
            details = f"Stats: {response}" if has_all_fields else f"Missing fields in response: {response}"
            
            self.log_test("Dashboard Stats API", has_all_fields, details)
            return has_all_fields
        else:
            self.log_test("Dashboard Stats API", False, "Failed to get dashboard stats")
            return False

    def cleanup_test_patient(self):
        """Clean up test patient"""
        if self.patient_id:
            success, _ = self.run_test(
                "Cleanup Test Patient",
                "DELETE",
                f"api/patients/{self.patient_id}",
                200
            )
            self.log_test("Cleanup Test Patient", success)
            return success
        return True

def main():
    print("🏥 Testing Arandu Clinic - Patient New Fields Implementation")
    print("=" * 65)
    
    tester = PatientNewFieldsTester()
    
    # Test authentication first
    if not tester.register_test_doctor():
        print("❌ Failed to authenticate, stopping tests")
        return 1
    
    print("\n📋 Testing Patient Management with New Fields")
    print("-" * 45)
    
    # Run all tests
    test_results = []
    test_results.append(tester.test_patient_creation_with_new_fields())
    test_results.append(tester.test_patient_retrieval_with_new_fields()) 
    test_results.append(tester.test_patient_update_with_new_fields())
    test_results.append(tester.test_patient_listing_includes_new_fields())
    test_results.append(tester.test_dashboard_stats())
    
    # Cleanup
    tester.cleanup_test_patient()
    
    print("\n" + "=" * 65)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if all(test_results):
        print("🎉 All patient new field tests passed!")
        return 0
    else:
        print("⚠️ Some tests failed. Check the details above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())