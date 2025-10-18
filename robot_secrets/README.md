# Robot Secrets

This directory contains secret key files for robot authentication.

## File Structure

Each robot has its own secret key file named `<robot-id>.key`:
- The filename (without `.key` extension) is the robot ID
- The file contains a single line with the secret key
- Robot IDs must contain only alphanumeric characters, hyphens, and underscores

## Generating Secret Keys

To generate a new secret key for a robot:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))" > robot_secrets/<robot-id>.key
```

For example, to create a key for robot "robot-2":

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))" > robot_secrets/robot-2.key
```

## Security

**IMPORTANT**:
- Never commit `.key` files to version control
- The `robot_secrets/*.key` pattern is in `.gitignore`
- Keep these files secure and backed up separately
- Rotate keys periodically

## Configuration

To allow a robot to connect to a space:

1. Create a key file for the robot (e.g., `robot-2.key`)
2. Add the robot ID to the space's `robot_ids` array in `portalbot_spaces.yml`:

```yaml
spaces:
  - id: "robot-space"
    display_name: "Robot Space"
    robot_ids: ["robot-1", "robot-2"]  # List of allowed robot IDs
```

3. Configure the robot with its ID in `portalbot_robot.yml`:

```yaml
robot_id: "robot-1"
robot_name: "Robot 1"
space_id: "robot-space"
```

## Example Files

- `robot-1.key` - Example secret key for robot-1
