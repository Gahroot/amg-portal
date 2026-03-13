"""Tests for SLA service pure functions."""


from app.models.enums import CommunicationType
from app.services.sla_service import SLA_CONFIG, get_sla_config


class TestGetSLAConfig:
    def test_email_sla(self) -> None:
        assert get_sla_config(CommunicationType.email) == 24

    def test_portal_message_sla(self) -> None:
        assert get_sla_config(CommunicationType.portal_message) == 4

    def test_phone_sla(self) -> None:
        assert get_sla_config(CommunicationType.phone) == 4

    def test_partner_submission_sla(self) -> None:
        assert get_sla_config(CommunicationType.partner_submission) == 48

    def test_client_inquiry_sla(self) -> None:
        assert get_sla_config(CommunicationType.client_inquiry) == 24

    def test_all_communication_types_have_config(self) -> None:
        for comm_type in CommunicationType:
            hours = get_sla_config(comm_type)
            assert isinstance(hours, int)
            assert hours > 0


class TestSLAConfigConsistency:
    def test_config_has_positive_hours(self) -> None:
        for comm_type, hours in SLA_CONFIG.items():
            assert hours > 0, f"{comm_type} has non-positive SLA hours"

    def test_portal_message_faster_than_email(self) -> None:
        assert SLA_CONFIG[CommunicationType.portal_message] < SLA_CONFIG[CommunicationType.email]
