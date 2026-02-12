from basic_bot.commons import env, constants as c


PB_ONBOARD_UI_PORT = env.env_int(
    "PB_ONBOARD_UI_PORT", 5806 if c.BB_ENV == "test" else 5807
)
