from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User


ORGANIZER_FIELDS = ["organization_name", "phone", "organizer_about"]


class RegisterSerializer(serializers.ModelSerializer):
    password  = serializers.CharField(write_only=True, min_length=8)
    password2 = serializers.CharField(write_only=True, label="Confirm password")

    class Meta:
        model  = User
        # is_approved / organizer_status are deliberately not listed, so the request can't set them.
        fields = ["email", "username", "password", "password2", "role"] + ORGANIZER_FIELDS

    def validate_role(self, value):
        if value == User.Role.ADMIN:
            raise serializers.ValidationError("Admin registration is not allowed.")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError({"password2": "Passwords do not match."})
        if attrs.get("role") == User.Role.ORGANIZER:
            missing = {f: "This field is required for organizers." for f in ORGANIZER_FIELDS
                       if not str(attrs.get(f, "")).strip()}
            if missing:
                raise serializers.ValidationError(missing)
        else:
            # Application details only belong to organizers.
            for f in ORGANIZER_FIELDS:
                attrs.pop(f, None)
        return attrs

    def create(self, validated_data):
        validated_data.pop("password2")
        role = validated_data.get("role", User.Role.CUSTOMER)
        extra = {f: validated_data[f].strip() for f in ORGANIZER_FIELDS if f in validated_data}
        if role == User.Role.ORGANIZER:
            # New organizers always wait for an admin, whatever the request said.
            extra.update(is_approved=False, organizer_status=User.OrganizerStatus.PENDING)
        return User.objects.create_user(
            email=validated_data["email"],
            username=validated_data.get("username", validated_data["email"].split("@")[0]),
            password=validated_data["password"],
            role=role,
            **extra,
        )


class UserProfileSerializer(serializers.ModelSerializer):
    is_door_staff = serializers.SerializerMethodField()

    def get_is_door_staff(self, user):
        return user.door_events.exists()

    class Meta:
        model  = User
        fields = ["id", "username", "email", "role", "is_approved", "organizer_status", "is_door_staff",
                  "phone", "bio", "avatar", "dob", "address"]
        read_only_fields = ["id", "email", "role", "is_approved", "organizer_status"]


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Login with email + password. Blocks unapproved organizers."""

    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user
        blocked = user.organizer_block()
        if blocked:
            raise serializers.ValidationError(blocked[1])
        # Attach user info to token response
        data["user"] = {
            "id":       user.id,
            "email":    user.email,
            "username": user.username,
            "role":     user.role,
        }
        return data
