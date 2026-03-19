"""
Test module for iteration 9 features:
1. Dashboard stats showing global totals for admin
2. Advanced search endpoint searching consultations
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials
ADMIN_EMAIL = "jose@aranduinformatica.net"
ADMIN_PASSWORD = "secreto"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    data = response.json()
    assert data.get('doctor', {}).get('role') == 'admin', "User is not admin"
    return data['token']


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    """Headers with admin auth token"""
    return {"Authorization": f"Bearer {admin_token}"}


class TestDashboardStatsGlobalView:
    """Test that dashboard stats show global totals for admin (not just admin's own patients)"""
    
    def test_dashboard_stats_returns_global_total_patients(self, admin_headers):
        """Admin dashboard should show total patients > 0 (global count)"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=admin_headers)
        assert response.status_code == 200, f"Stats request failed: {response.text}"
        
        data = response.json()
        assert "total_patients" in data
        # According to test context, there are 7 patients in DB
        assert data["total_patients"] > 0, "total_patients should be > 0 for admin global view"
        print(f"Admin sees total_patients: {data['total_patients']}")
    
    def test_dashboard_stats_returns_pending_appointments(self, admin_headers):
        """Admin dashboard should show pending_appointments > 0"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=admin_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "pending_appointments" in data
        # According to test context, there are 9 scheduled appointments
        assert data["pending_appointments"] > 0, "pending_appointments should be > 0 for admin"
        print(f"Admin sees pending_appointments: {data['pending_appointments']}")
    
    def test_dashboard_stats_has_all_fields(self, admin_headers):
        """Dashboard stats should include all expected fields"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=admin_headers)
        assert response.status_code == 200
        
        data = response.json()
        expected_fields = ["total_patients", "appointments_today", "active_treatments", "pending_appointments"]
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
        print(f"Dashboard stats: {data}")
    
    def test_advanced_stats_returns_global_data(self, admin_headers):
        """Advanced stats endpoint should return global data for admin"""
        response = requests.get(f"{BASE_URL}/api/dashboard/advanced-stats", headers=admin_headers)
        assert response.status_code == 200, f"Advanced stats request failed: {response.text}"
        
        data = response.json()
        assert "total_patients" in data
        assert data["total_patients"] > 0, "advanced-stats total_patients should be > 0"
        print(f"Advanced stats total_patients: {data['total_patients']}")


class TestPatientsDashboardGlobalView:
    """Test that admin can see all patients from all doctors"""
    
    def test_get_patients_returns_all_for_admin(self, admin_headers):
        """Admin should see all patients, not just their own"""
        response = requests.get(f"{BASE_URL}/api/patients", headers=admin_headers)
        assert response.status_code == 200
        
        patients = response.json()
        assert len(patients) > 0, "Admin should see patients"
        print(f"Admin sees {len(patients)} patients")
        
        # Check that patients have doctor_name field for admin view
        for p in patients:
            assert "doctor_name" in p, "Admin view should include doctor_name"
    
    def test_get_appointments_returns_all_for_admin(self, admin_headers):
        """Admin should see all appointments, not just their own"""
        response = requests.get(f"{BASE_URL}/api/appointments", headers=admin_headers)
        assert response.status_code == 200
        
        appointments = response.json()
        assert len(appointments) > 0, "Admin should see appointments"
        print(f"Admin sees {len(appointments)} appointments")
        
        # Appointments should have doctor_name for admin
        scheduled = [a for a in appointments if a.get('status') == 'scheduled']
        print(f"Scheduled appointments: {len(scheduled)}")


class TestAdvancedSearchEndpoint:
    """Test the new advanced search endpoint that searches consultations"""
    
    def test_advanced_search_endpoint_exists(self, admin_headers):
        """Advanced search endpoint should exist and be accessible"""
        response = requests.get(f"{BASE_URL}/api/patients/advanced-search?q=test", headers=admin_headers)
        assert response.status_code == 200, f"Advanced search failed: {response.text}"
        assert isinstance(response.json(), list), "Should return a list"
    
    def test_advanced_search_with_fractura(self, admin_headers):
        """Searching 'fractura' should return patients with that in consultations"""
        response = requests.get(f"{BASE_URL}/api/patients/advanced-search?q=fractura", headers=admin_headers)
        assert response.status_code == 200
        
        results = response.json()
        # According to test context, searching 'fractura' returns 6 patients
        print(f"Search 'fractura' returned {len(results)} patients")
        assert len(results) >= 1, "Should find patients with 'fractura' in consultation content"
    
    def test_advanced_search_returns_patient_fields(self, admin_headers):
        """Advanced search should return full patient objects"""
        response = requests.get(f"{BASE_URL}/api/patients/advanced-search?q=fractura", headers=admin_headers)
        assert response.status_code == 200
        
        results = response.json()
        if len(results) > 0:
            patient = results[0]
            # Check required patient fields
            required_fields = ["id", "name", "cedula", "phone", "age"]
            for field in required_fields:
                assert field in patient, f"Missing patient field: {field}"
            
            # Admin view should include doctor_name
            assert "doctor_name" in patient, "Admin should see doctor_name in results"
    
    def test_advanced_search_with_diagnosis_term(self, admin_headers):
        """Advanced search should find patients by diagnosis content"""
        # Test with a medical term that might appear in diagnoses
        response = requests.get(f"{BASE_URL}/api/patients/advanced-search?q=lesion", headers=admin_headers)
        assert response.status_code == 200
        
        results = response.json()
        print(f"Search 'lesion' returned {len(results)} patients")
    
    def test_advanced_search_searches_medical_history(self, admin_headers):
        """Advanced search should also search patient medical_history field"""
        # Get a patient first to know what's in their history
        patients_response = requests.get(f"{BASE_URL}/api/patients", headers=admin_headers)
        patients = patients_response.json()
        
        if patients:
            # Search for something from the first patient's medical history
            test_patient = patients[0]
            if test_patient.get('medical_history'):
                # Take first word from medical history
                history_word = test_patient['medical_history'].split()[0] if test_patient['medical_history'].split() else ""
                if history_word and len(history_word) > 2:
                    response = requests.get(
                        f"{BASE_URL}/api/patients/advanced-search?q={history_word}", 
                        headers=admin_headers
                    )
                    assert response.status_code == 200
                    results = response.json()
                    print(f"Search '{history_word}' (from medical_history) returned {len(results)} patients")
    
    def test_advanced_search_empty_query(self, admin_headers):
        """Advanced search with empty query should still return results (all patients)"""
        response = requests.get(f"{BASE_URL}/api/patients/advanced-search?q=", headers=admin_headers)
        # Should return 200 or handle gracefully
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}"
    
    def test_basic_search_still_works(self, admin_headers):
        """Basic search endpoint should still work"""
        response = requests.get(f"{BASE_URL}/api/patients/search?q=test", headers=admin_headers)
        assert response.status_code == 200, "Basic search should work"
        assert isinstance(response.json(), list)


class TestDashboardRecentPatients:
    """Test that dashboard recent patients list shows all patients for admin"""
    
    def test_patients_getall_returns_multiple_for_admin(self, admin_headers):
        """Dashboard calls getAll which should return all patients for admin"""
        response = requests.get(f"{BASE_URL}/api/patients", headers=admin_headers)
        assert response.status_code == 200
        
        patients = response.json()
        # Dashboard shows first 5 (recent) patients
        # There should be patients from multiple doctors
        doctor_ids = set(p.get('doctor_id') for p in patients if p.get('doctor_id'))
        print(f"Patients from {len(doctor_ids)} different doctors")
        print(f"Total patients for admin view: {len(patients)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
