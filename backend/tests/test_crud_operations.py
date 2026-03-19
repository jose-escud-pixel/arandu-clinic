"""
Test suite for CRUD operations - Focus on NEW PUT/DELETE endpoints for:
- Appointments (PUT /api/appointments/{id}, DELETE /api/appointments/{id})
- Consultations (PUT /api/consultations/{id}, DELETE /api/consultations/{id})
- Prescriptions (PUT /api/prescriptions/{id}, DELETE /api/prescriptions/{id})
- Files (DELETE /api/files/{id})
- Patients (DELETE /api/patients/{id})
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuthentication:
    """Test login and get auth token"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "doc@test.com",
            "password": "test123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data
        return data["token"]
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "doc@test.com",
            "password": "test123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "doctor" in data
        print("✅ Login successful")


@pytest.fixture(scope="module")
def auth_headers():
    """Get authentication headers for all tests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "doc@test.com",
        "password": "test123"
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    token = response.json()["token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def test_patient(auth_headers):
    """Create a test patient for CRUD operations"""
    patient_data = {
        "name": "TEST_CRUD_Patient",
        "age": 35,
        "cedula": "TEST123456",
        "address": "Test Address 123",
        "occupation": "Tester",
        "phone": "555-TEST",
        "medical_history": "Test patient for CRUD operations"
    }
    response = requests.post(f"{BASE_URL}/api/patients", json=patient_data, headers=auth_headers)
    assert response.status_code == 200, f"Failed to create patient: {response.text}"
    patient = response.json()
    yield patient
    # Cleanup - delete patient after tests
    requests.delete(f"{BASE_URL}/api/patients/{patient['id']}", headers=auth_headers)


class TestAppointmentCRUD:
    """Test Appointment CRUD operations - Focus on PUT and DELETE"""
    
    def test_create_appointment(self, auth_headers, test_patient):
        """Create appointment for testing update/delete"""
        future_date = (datetime.now() + timedelta(days=7)).isoformat()
        appointment_data = {
            "patient_id": test_patient["id"],
            "date": future_date,
            "reason": "TEST_Initial checkup",
            "notes": "Test appointment for CRUD"
        }
        response = requests.post(f"{BASE_URL}/api/appointments", json=appointment_data, headers=auth_headers)
        assert response.status_code == 200, f"Failed to create appointment: {response.text}"
        data = response.json()
        assert data["reason"] == "TEST_Initial checkup"
        assert "id" in data
        print(f"✅ Created appointment: {data['id']}")
        return data
    
    def test_update_appointment(self, auth_headers, test_patient):
        """PUT /api/appointments/{id} - Update appointment"""
        # First create an appointment
        future_date = (datetime.now() + timedelta(days=8)).isoformat()
        create_response = requests.post(f"{BASE_URL}/api/appointments", json={
            "patient_id": test_patient["id"],
            "date": future_date,
            "reason": "TEST_Original reason",
            "notes": "Original notes"
        }, headers=auth_headers)
        assert create_response.status_code == 200
        appointment = create_response.json()
        appointment_id = appointment["id"]
        
        # Update the appointment
        new_date = (datetime.now() + timedelta(days=10)).isoformat()
        update_data = {
            "date": new_date,
            "reason": "TEST_Updated reason",
            "status": "completed",
            "notes": "Updated notes"
        }
        update_response = requests.put(f"{BASE_URL}/api/appointments/{appointment_id}", json=update_data, headers=auth_headers)
        assert update_response.status_code == 200, f"Failed to update appointment: {update_response.text}"
        update_result = update_response.json()
        assert update_result["message"] == "Cita actualizada"
        print(f"✅ Updated appointment: {appointment_id}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/appointments/{appointment_id}", headers=auth_headers)
    
    def test_update_appointment_partial(self, auth_headers, test_patient):
        """PUT /api/appointments/{id} - Partial update (only reason)"""
        future_date = (datetime.now() + timedelta(days=9)).isoformat()
        create_response = requests.post(f"{BASE_URL}/api/appointments", json={
            "patient_id": test_patient["id"],
            "date": future_date,
            "reason": "TEST_Partial update test"
        }, headers=auth_headers)
        appointment = create_response.json()
        appointment_id = appointment["id"]
        
        # Partial update - only reason
        update_response = requests.put(f"{BASE_URL}/api/appointments/{appointment_id}", json={
            "reason": "TEST_Partially updated"
        }, headers=auth_headers)
        assert update_response.status_code == 200
        print(f"✅ Partial update appointment successful")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/appointments/{appointment_id}", headers=auth_headers)
    
    def test_delete_appointment(self, auth_headers, test_patient):
        """DELETE /api/appointments/{id} - Delete appointment"""
        # Create appointment to delete
        future_date = (datetime.now() + timedelta(days=11)).isoformat()
        create_response = requests.post(f"{BASE_URL}/api/appointments", json={
            "patient_id": test_patient["id"],
            "date": future_date,
            "reason": "TEST_To be deleted"
        }, headers=auth_headers)
        appointment = create_response.json()
        appointment_id = appointment["id"]
        
        # Delete the appointment
        delete_response = requests.delete(f"{BASE_URL}/api/appointments/{appointment_id}", headers=auth_headers)
        assert delete_response.status_code == 200, f"Failed to delete appointment: {delete_response.text}"
        delete_result = delete_response.json()
        assert delete_result["message"] == "Cita eliminada"
        print(f"✅ Deleted appointment: {appointment_id}")
        
        # Verify deletion - should get 404
        verify_response = requests.get(f"{BASE_URL}/api/appointments", headers=auth_headers)
        appointments = verify_response.json()
        assert not any(a["id"] == appointment_id for a in appointments), "Appointment still exists after deletion"
        print("✅ Verified appointment deletion")
    
    def test_update_nonexistent_appointment(self, auth_headers):
        """PUT /api/appointments/{id} - 404 for nonexistent appointment"""
        response = requests.put(f"{BASE_URL}/api/appointments/nonexistent-id-12345", json={
            "reason": "Should fail"
        }, headers=auth_headers)
        assert response.status_code == 404
        print("✅ Correctly returns 404 for nonexistent appointment update")
    
    def test_delete_nonexistent_appointment(self, auth_headers):
        """DELETE /api/appointments/{id} - 404 for nonexistent appointment"""
        response = requests.delete(f"{BASE_URL}/api/appointments/nonexistent-id-12345", headers=auth_headers)
        assert response.status_code == 404
        print("✅ Correctly returns 404 for nonexistent appointment delete")


class TestConsultationCRUD:
    """Test Consultation CRUD operations - Focus on PUT and DELETE"""
    
    def test_create_consultation(self, auth_headers, test_patient):
        """Create consultation for testing"""
        consultation_data = {
            "patient_id": test_patient["id"],
            "diagnosis": "TEST_Initial diagnosis",
            "treatment": "TEST_Initial treatment",
            "notes": "Test consultation"
        }
        response = requests.post(f"{BASE_URL}/api/consultations", json=consultation_data, headers=auth_headers)
        assert response.status_code == 200, f"Failed to create consultation: {response.text}"
        data = response.json()
        assert data["diagnosis"] == "TEST_Initial diagnosis"
        print(f"✅ Created consultation: {data['id']}")
        return data
    
    def test_update_consultation(self, auth_headers, test_patient):
        """PUT /api/consultations/{id} - Update consultation"""
        # Create consultation
        create_response = requests.post(f"{BASE_URL}/api/consultations", json={
            "patient_id": test_patient["id"],
            "diagnosis": "TEST_Original diagnosis",
            "treatment": "Original treatment",
            "notes": "Original notes"
        }, headers=auth_headers)
        consultation = create_response.json()
        consultation_id = consultation["id"]
        
        # Update consultation
        update_data = {
            "diagnosis": "TEST_Updated diagnosis",
            "treatment": "Updated treatment",
            "notes": "Updated notes"
        }
        update_response = requests.put(f"{BASE_URL}/api/consultations/{consultation_id}", json=update_data, headers=auth_headers)
        assert update_response.status_code == 200, f"Failed to update consultation: {update_response.text}"
        update_result = update_response.json()
        assert update_result["message"] == "Consulta actualizada"
        print(f"✅ Updated consultation: {consultation_id}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/consultations/{consultation_id}", headers=auth_headers)
    
    def test_update_consultation_partial(self, auth_headers, test_patient):
        """PUT /api/consultations/{id} - Partial update"""
        create_response = requests.post(f"{BASE_URL}/api/consultations", json={
            "patient_id": test_patient["id"],
            "diagnosis": "TEST_Partial test",
            "treatment": "Treatment",
            "notes": "Notes"
        }, headers=auth_headers)
        consultation = create_response.json()
        consultation_id = consultation["id"]
        
        # Partial update - only diagnosis
        update_response = requests.put(f"{BASE_URL}/api/consultations/{consultation_id}", json={
            "diagnosis": "TEST_Partially updated"
        }, headers=auth_headers)
        assert update_response.status_code == 200
        print("✅ Partial update consultation successful")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/consultations/{consultation_id}", headers=auth_headers)
    
    def test_delete_consultation(self, auth_headers, test_patient):
        """DELETE /api/consultations/{id} - Delete consultation"""
        # Create consultation
        create_response = requests.post(f"{BASE_URL}/api/consultations", json={
            "patient_id": test_patient["id"],
            "diagnosis": "TEST_To be deleted",
            "treatment": "Treatment",
            "notes": "Notes"
        }, headers=auth_headers)
        consultation = create_response.json()
        consultation_id = consultation["id"]
        
        # Delete
        delete_response = requests.delete(f"{BASE_URL}/api/consultations/{consultation_id}", headers=auth_headers)
        assert delete_response.status_code == 200, f"Failed to delete consultation: {delete_response.text}"
        delete_result = delete_response.json()
        assert delete_result["message"] == "Consulta eliminada"
        print(f"✅ Deleted consultation: {consultation_id}")
    
    def test_update_nonexistent_consultation(self, auth_headers):
        """PUT /api/consultations/{id} - 404 for nonexistent"""
        response = requests.put(f"{BASE_URL}/api/consultations/nonexistent-id-12345", json={
            "diagnosis": "Should fail"
        }, headers=auth_headers)
        assert response.status_code == 404
        print("✅ Correctly returns 404 for nonexistent consultation update")
    
    def test_delete_nonexistent_consultation(self, auth_headers):
        """DELETE /api/consultations/{id} - 404 for nonexistent"""
        response = requests.delete(f"{BASE_URL}/api/consultations/nonexistent-id-12345", headers=auth_headers)
        assert response.status_code == 404
        print("✅ Correctly returns 404 for nonexistent consultation delete")


class TestPrescriptionCRUD:
    """Test Prescription CRUD operations - Focus on PUT and DELETE"""
    
    def test_create_prescription(self, auth_headers, test_patient):
        """Create prescription for testing"""
        prescription_data = {
            "patient_id": test_patient["id"],
            "medications": "TEST_Ibuprofen 600mg",
            "instructions": "Take every 8 hours",
            "diagnosis": "TEST_Pain management"
        }
        response = requests.post(f"{BASE_URL}/api/prescriptions", json=prescription_data, headers=auth_headers)
        assert response.status_code == 200, f"Failed to create prescription: {response.text}"
        data = response.json()
        assert data["medications"] == "TEST_Ibuprofen 600mg"
        print(f"✅ Created prescription: {data['id']}")
        return data
    
    def test_update_prescription(self, auth_headers, test_patient):
        """PUT /api/prescriptions/{id} - Update prescription"""
        # Create prescription
        create_response = requests.post(f"{BASE_URL}/api/prescriptions", json={
            "patient_id": test_patient["id"],
            "medications": "TEST_Original medication",
            "instructions": "Original instructions",
            "diagnosis": "Original diagnosis"
        }, headers=auth_headers)
        prescription = create_response.json()
        prescription_id = prescription["id"]
        
        # Update
        update_data = {
            "medications": "TEST_Updated medication",
            "instructions": "Updated instructions",
            "diagnosis": "Updated diagnosis"
        }
        update_response = requests.put(f"{BASE_URL}/api/prescriptions/{prescription_id}", json=update_data, headers=auth_headers)
        assert update_response.status_code == 200, f"Failed to update prescription: {update_response.text}"
        update_result = update_response.json()
        assert update_result["message"] == "Receta actualizada"
        print(f"✅ Updated prescription: {prescription_id}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/prescriptions/{prescription_id}", headers=auth_headers)
    
    def test_update_prescription_partial(self, auth_headers, test_patient):
        """PUT /api/prescriptions/{id} - Partial update"""
        create_response = requests.post(f"{BASE_URL}/api/prescriptions", json={
            "patient_id": test_patient["id"],
            "medications": "TEST_Partial test",
            "instructions": "Instructions",
            "diagnosis": "Diagnosis"
        }, headers=auth_headers)
        prescription = create_response.json()
        prescription_id = prescription["id"]
        
        # Partial update
        update_response = requests.put(f"{BASE_URL}/api/prescriptions/{prescription_id}", json={
            "medications": "TEST_Partially updated"
        }, headers=auth_headers)
        assert update_response.status_code == 200
        print("✅ Partial update prescription successful")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/prescriptions/{prescription_id}", headers=auth_headers)
    
    def test_delete_prescription(self, auth_headers, test_patient):
        """DELETE /api/prescriptions/{id} - Delete prescription"""
        # Create prescription
        create_response = requests.post(f"{BASE_URL}/api/prescriptions", json={
            "patient_id": test_patient["id"],
            "medications": "TEST_To be deleted",
            "instructions": "Instructions",
            "diagnosis": "Diagnosis"
        }, headers=auth_headers)
        prescription = create_response.json()
        prescription_id = prescription["id"]
        
        # Delete
        delete_response = requests.delete(f"{BASE_URL}/api/prescriptions/{prescription_id}", headers=auth_headers)
        assert delete_response.status_code == 200, f"Failed to delete prescription: {delete_response.text}"
        delete_result = delete_response.json()
        assert delete_result["message"] == "Receta eliminada"
        print(f"✅ Deleted prescription: {prescription_id}")
    
    def test_update_nonexistent_prescription(self, auth_headers):
        """PUT /api/prescriptions/{id} - 404 for nonexistent"""
        response = requests.put(f"{BASE_URL}/api/prescriptions/nonexistent-id-12345", json={
            "medications": "Should fail"
        }, headers=auth_headers)
        assert response.status_code == 404
        print("✅ Correctly returns 404 for nonexistent prescription update")
    
    def test_delete_nonexistent_prescription(self, auth_headers):
        """DELETE /api/prescriptions/{id} - 404 for nonexistent"""
        response = requests.delete(f"{BASE_URL}/api/prescriptions/nonexistent-id-12345", headers=auth_headers)
        assert response.status_code == 404
        print("✅ Correctly returns 404 for nonexistent prescription delete")


class TestFileDelete:
    """Test File DELETE operation"""
    
    def test_delete_nonexistent_file(self, auth_headers):
        """DELETE /api/files/{id} - 404 for nonexistent"""
        response = requests.delete(f"{BASE_URL}/api/files/nonexistent-id-12345", headers=auth_headers)
        assert response.status_code == 404
        print("✅ Correctly returns 404 for nonexistent file delete")


class TestPatientDelete:
    """Test Patient DELETE operation with confirmation"""
    
    def test_create_and_delete_patient(self, auth_headers):
        """DELETE /api/patients/{id} - Create and delete patient"""
        # Create patient
        patient_data = {
            "name": "TEST_ToDelete_Patient",
            "age": 25,
            "cedula": "DELETE123",
            "address": "Delete Address",
            "occupation": "Testing",
            "phone": "555-DELETE",
            "medical_history": "To be deleted"
        }
        create_response = requests.post(f"{BASE_URL}/api/patients", json=patient_data, headers=auth_headers)
        assert create_response.status_code == 200
        patient = create_response.json()
        patient_id = patient["id"]
        
        # Delete
        delete_response = requests.delete(f"{BASE_URL}/api/patients/{patient_id}", headers=auth_headers)
        assert delete_response.status_code == 200, f"Failed to delete patient: {delete_response.text}"
        delete_result = delete_response.json()
        assert delete_result["message"] == "Paciente eliminado"
        print(f"✅ Deleted patient: {patient_id}")
        
        # Verify deletion
        verify_response = requests.get(f"{BASE_URL}/api/patients/{patient_id}", headers=auth_headers)
        assert verify_response.status_code == 404
        print("✅ Verified patient deletion (404 on GET)")
    
    def test_delete_nonexistent_patient(self, auth_headers):
        """DELETE /api/patients/{id} - 404 for nonexistent"""
        response = requests.delete(f"{BASE_URL}/api/patients/nonexistent-id-12345", headers=auth_headers)
        assert response.status_code == 404
        print("✅ Correctly returns 404 for nonexistent patient delete")
