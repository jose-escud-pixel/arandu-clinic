"""
Backend Tests for 4 New Features:
1. Activity log system
2. Admin global view (admin sees all patients/appointments)
3. Filtering by doctor on patients/appointments
4. Custom doctor logo for prescription PDFs
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials
ADMIN_EMAIL = "jose@aranduinformatica.net"
ADMIN_PASSWORD = "secreto"

# Store tokens and ids across tests
_state = {}

# ============================================
# FIXTURES
# ============================================

@pytest.fixture(scope="module")
def admin_token():
    """Login as admin user and get token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    data = response.json()
    _state['admin_token'] = data['token']
    _state['admin_id'] = data['doctor']['id']
    _state['admin_name'] = data['doctor']['name']
    _state['admin_role'] = data['doctor'].get('role')
    return data['token']

@pytest.fixture
def admin_headers(admin_token):
    """Authorization headers for admin requests"""
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ============================================
# 1. ADMIN GLOBAL VIEW - PATIENTS
# ============================================

class TestAdminGlobalViewPatients:
    """Admin should see ALL patients from all doctors"""

    def test_admin_can_login_as_admin(self, admin_token):
        """Verify admin login works and role is admin"""
        assert admin_token is not None
        assert _state.get('admin_role') == 'admin', "User should have admin role"
        print(f"✅ Admin login successful - role: {_state.get('admin_role')}")

    def test_admin_gets_patients_with_doctor_name(self, admin_headers):
        """Admin GET /api/patients should return all patients with doctor_name field"""
        response = requests.get(f"{BASE_URL}/api/patients", headers=admin_headers)
        assert response.status_code == 200, f"Failed to get patients: {response.text}"
        
        patients = response.json()
        print(f"✅ Admin received {len(patients)} patients")
        
        # If there are patients, check they have doctor_name field
        if len(patients) > 0:
            patient = patients[0]
            assert 'doctor_name' in patient, "Admin view should include doctor_name field"
            print(f"✅ Patient has doctor_name field: {patient.get('doctor_name')}")
        
        _state['patients'] = patients

    def test_admin_can_view_patient_detail(self, admin_headers):
        """Admin can view any patient's detail, even from other doctors"""
        patients = _state.get('patients', [])
        if len(patients) == 0:
            pytest.skip("No patients to test")
        
        patient_id = patients[0]['id']
        response = requests.get(f"{BASE_URL}/api/patients/{patient_id}", headers=admin_headers)
        assert response.status_code == 200, f"Admin cannot view patient detail: {response.text}"
        print(f"✅ Admin can view patient detail: {patient_id}")


# ============================================
# 2. ADMIN GLOBAL VIEW - APPOINTMENTS
# ============================================

class TestAdminGlobalViewAppointments:
    """Admin should see ALL appointments from all doctors"""

    def test_admin_gets_appointments_with_doctor_name(self, admin_headers):
        """Admin GET /api/appointments should return all appointments with doctor_name"""
        response = requests.get(f"{BASE_URL}/api/appointments", headers=admin_headers)
        assert response.status_code == 200, f"Failed to get appointments: {response.text}"
        
        appointments = response.json()
        print(f"✅ Admin received {len(appointments)} appointments")
        
        # If there are appointments, check they have doctor_name field
        if len(appointments) > 0:
            apt = appointments[0]
            assert 'doctor_name' in apt, "Admin view should include doctor_name in appointments"
            print(f"✅ Appointment has doctor_name field: {apt.get('doctor_name')}")
        
        _state['appointments'] = appointments


# ============================================
# 3. ACTIVITY LOG SYSTEM
# ============================================

class TestActivityLogSystem:
    """Test activity logging functionality"""

    def test_activity_log_endpoint_exists(self, admin_headers):
        """GET /api/admin/activity-logs should return logs with pagination"""
        response = requests.get(f"{BASE_URL}/api/admin/activity-logs?limit=50&skip=0", headers=admin_headers)
        assert response.status_code == 200, f"Activity logs endpoint failed: {response.text}"
        
        data = response.json()
        assert 'logs' in data, "Response should have 'logs' field"
        assert 'total' in data, "Response should have 'total' field"
        
        print(f"✅ Activity log endpoint working - Total logs: {data['total']}")
        _state['activity_logs_count_before'] = data['total']

    def test_create_patient_logs_activity(self, admin_headers):
        """Creating a patient should add an activity log entry"""
        # Get current log count
        response = requests.get(f"{BASE_URL}/api/admin/activity-logs?limit=1&skip=0", headers=admin_headers)
        before_count = response.json()['total']
        
        # Create a test patient
        patient_data = {
            "name": "TEST_ActivityLog_Patient",
            "age": 35,
            "cedula": "TEST-ACT-001",
            "address": "Test Address",
            "occupation": "Test Job",
            "phone": "555-TEST-001",
            "medical_history": "Test medical history for activity log"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/patients", json=patient_data, headers=admin_headers)
        assert create_response.status_code == 200, f"Failed to create patient: {create_response.text}"
        
        patient = create_response.json()
        _state['test_patient_id'] = patient['id']
        print(f"✅ Test patient created: {patient['id']}")
        
        # Check log count increased
        response = requests.get(f"{BASE_URL}/api/admin/activity-logs?limit=1&skip=0", headers=admin_headers)
        after_count = response.json()['total']
        
        assert after_count > before_count, "Activity log should be created after patient creation"
        print(f"✅ Activity log created (count: {before_count} -> {after_count})")

    def test_activity_log_has_required_fields(self, admin_headers):
        """Activity log entries should have proper structure"""
        response = requests.get(f"{BASE_URL}/api/admin/activity-logs?limit=5&skip=0", headers=admin_headers)
        data = response.json()
        
        if len(data['logs']) > 0:
            log = data['logs'][0]
            required_fields = ['id', 'user_id', 'user_name', 'action', 'target_type', 'target_id', 'details', 'timestamp']
            for field in required_fields:
                assert field in log, f"Activity log missing field: {field}"
            print(f"✅ Activity log has all required fields: {list(log.keys())}")

    def test_activity_log_requires_admin(self):
        """Non-admin users should not access activity logs (403)"""
        # Request without proper admin auth should fail
        response = requests.get(f"{BASE_URL}/api/admin/activity-logs")
        assert response.status_code in [401, 403], "Activity logs should require authentication"
        print(f"✅ Activity log endpoint properly protected (status: {response.status_code})")


# ============================================
# 4. LOGO UPLOAD FOR PRESCRIPTIONS
# ============================================

class TestLogoUpload:
    """Test logo upload functionality for prescription PDFs"""

    def test_upload_logo_endpoint_exists(self, admin_headers):
        """POST /api/auth/upload-logo should be available"""
        # Create a minimal test image (1x1 PNG)
        import base64
        png_data = base64.b64decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        )
        
        files = {'file': ('test_logo.png', png_data, 'image/png')}
        headers = {"Authorization": admin_headers['Authorization']}
        
        response = requests.post(f"{BASE_URL}/api/auth/upload-logo", files=files, headers=headers)
        assert response.status_code == 200, f"Logo upload failed: {response.text}"
        
        data = response.json()
        assert 'logo_url' in data, "Response should have logo_url"
        _state['logo_url'] = data['logo_url']
        print(f"✅ Logo uploaded successfully: {data['logo_url']}")

    def test_logo_url_returned_in_me(self, admin_headers):
        """GET /api/auth/me should return logo_url field"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=admin_headers)
        assert response.status_code == 200, f"Failed to get user info: {response.text}"
        
        data = response.json()
        # After uploading, logo_url should be present
        if _state.get('logo_url'):
            assert data.get('logo_url') == _state['logo_url'], "logo_url should match uploaded logo"
            print(f"✅ logo_url returned in /api/auth/me: {data.get('logo_url')}")
        else:
            print(f"ℹ️ logo_url in profile: {data.get('logo_url')}")

    def test_logo_rejects_non_image(self, admin_headers):
        """Logo upload should reject non-image files"""
        files = {'file': ('test.txt', b'not an image', 'text/plain')}
        headers = {"Authorization": admin_headers['Authorization']}
        
        response = requests.post(f"{BASE_URL}/api/auth/upload-logo", files=files, headers=headers)
        assert response.status_code == 400, f"Non-image should be rejected, got: {response.status_code}"
        print("✅ Non-image file correctly rejected with 400")


# ============================================
# 5. SEARCH FILTERS
# ============================================

class TestSearchFilters:
    """Test search functionality on patients and appointments"""

    def test_patient_search_endpoint(self, admin_headers):
        """GET /api/patients/search works for admin"""
        response = requests.get(f"{BASE_URL}/api/patients/search?q=TEST", headers=admin_headers)
        assert response.status_code == 200, f"Patient search failed: {response.text}"
        
        patients = response.json()
        print(f"✅ Patient search working - found {len(patients)} results for 'TEST'")


# ============================================
# 6. CLEANUP
# ============================================

class TestCleanup:
    """Clean up test data"""

    def test_delete_test_patient(self, admin_headers):
        """Delete the test patient created during activity log tests"""
        patient_id = _state.get('test_patient_id')
        if not patient_id:
            pytest.skip("No test patient to delete")
        
        response = requests.delete(f"{BASE_URL}/api/patients/{patient_id}", headers=admin_headers)
        assert response.status_code == 200, f"Failed to delete test patient: {response.text}"
        print(f"✅ Test patient deleted: {patient_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
