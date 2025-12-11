Gemini live
GeminiLiveVoiceAgent #
Bases: BaseVoiceAgent

Gemini Live Voice Agent.

Source code in llama_index/voice_agents/gemini_live/base.py

class GeminiLiveVoiceAgent(BaseVoiceAgent):
    """
    Gemini Live Voice Agent.
    """

    def __init__(
        self,
        model: Optional[str] = None,
        interface: Optional[GeminiLiveVoiceAgentInterface] = None,
        api_key: Optional[str] = None,
        tools: Optional[List[BaseTool]] = None,
    ):
        self.model: str = model or DEFAULT_MODEL
        self._client: Optional[Client] = None
        self.session: Optional[AsyncSession] = None
        self._quitflag: bool = False
        interface = interface or GeminiLiveVoiceAgentInterface()
        super().__init__(api_key=api_key, tools=tools, interface=interface)
        if self.tools is not None:
            self.gemini_tools: List[Dict[str, List[Dict[str, str]]]] = (
                tools_to_gemini_tools(tools)
            )
            self._functions_dict: Dict[
                str, Callable[[Dict[str, Any], str, str], types.FunctionResponse]
            ] = tools_to_functions_dict(self.tools)
        else:
            self.gemini_tools = []
            self._functions_dict = {}

    @property
    def client(self) -> Client:
        if not self._client:
            self._client = Client(
                api_key=self.api_key, http_options={"api_version": "v1beta"}
            )
        return self._client

    def _signal_exit(self):
        logging.info("Preparing exit...")
        self._quitflag = True

    @override
    async def _start(self, session: AsyncSession) -> None:
        """
        Start the voice agent.
        """
        self.interface.start(session=session)

    async def _run_loop(self) -> None:
        logging.info("The agent is ready for the conversation")
        logging.info("Type q and press enter to stop the conversation at any time")
        while not self._quitflag:
            text = await asyncio.to_thread(
                input,
                "",
            )
            if text == "q":
                self._signal_exit()
            await self.session.send(input=text or ".", end_of_turn=True)
        logging.info("Session has been successfully closed")
        await self.interrupt()
        await self.stop()

    async def send(self) -> None:
        """
        Send audio to the websocket underlying the voice agent.
        """
        while True:
            msg = await self.interface.out_queue.get()
            await self.session.send(input=msg)

    @override
    async def handle_message(self) -> Any:
        """
        Handle incoming message.

        Args:
            message (Any): incoming message (should be dict, but it is kept open also for other types).
            *args: Can take any positional argument.
            **kwargs: Can take any keyword argument.

        Returns:
            out (Any): This function can return any output.

        """
        while True:
            turn = self.session.receive()
            async for response in turn:
                if response.server_content:
                    if data := response.data:
                        await self.interface.receive(data=data)
                        self._messages.append(
                            ChatMessage(
                                role="assistant", blocks=[AudioBlock(audio=data)]
                            )
                        )
                        self._events.append(
                            AudioReceivedEvent(type_t="audio_received", data=data)
                        )
                        continue
                    if text := response.text:
                        self._messages.append(
                            ChatMessage(role="assistant", blocks=[TextBlock(text=text)])
                        )
                        self._events.append(
                            TextReceivedEvent(type_t="text_received", text=text)
                        )
                elif tool_call := response.tool_call:
                    function_responses: List[types.FunctionResponse] = []
                    for fn_call in tool_call.function_calls:
                        self._events.append(
                            ToolCallEvent(
                                type_t="tool_call",
                                tool_name=fn_call.name,
                                tool_args=fn_call.args,
                            )
                        )
                        result = self._functions_dict[fn_call.name](
                            fn_call.args, fn_call.id, fn_call.name
                        )
                        self._events.append(
                            ToolCallResultEvent(
                                type_t="tool_call_result",
                                tool_name=result.name,
                                tool_result=result.response,
                            )
                        )
                        function_responses.append(result)
                    await self.session.send_tool_response(
                        function_responses=function_responses
                    )
            while not self.interface.audio_in_queue.empty():
                await self.interrupt()

    async def start(self):
        try:
            async with (
                self.client.aio.live.connect(
                    model=self.model,
                    config={
                        "response_modalities": ["AUDIO"],
                        "tools": self.gemini_tools,
                    },
                ) as session,
                asyncio.TaskGroup() as tg,
            ):
                self.session = session
                await self._start(session=session)

                _run_loop = tg.create_task(self._run_loop())
                tg.create_task(self.send())
                tg.create_task(self.interface._microphone_callback())
                tg.create_task(self.handle_message())
                tg.create_task(self.interface.output())

                await _run_loop
                raise asyncio.CancelledError("User requested exit")

        except asyncio.CancelledError:
            pass
        except ExceptionGroup as EG:
            await self.stop()

    async def interrupt(self) -> None:
        """
        Interrupt the input/output audio flow.

        Args:
            None
        Returns:
            out (None): This function does not return anything.

        """
        self.interface.interrupt()

    async def stop(self) -> None:
        """
        Stop the conversation with the voice agent.

        Args:
            None
        Returns:
            out (None): This function does not return anything.

        """
        self.interface.stop()
send async #

send() -> None
Send audio to the websocket underlying the voice agent.

Source code in llama_index/voice_agents/gemini_live/base.py

async def send(self) -> None:
    """
    Send audio to the websocket underlying the voice agent.
    """
    while True:
        msg = await self.interface.out_queue.get()
        await self.session.send(input=msg)
handle_message async #

handle_message() -> Any
Handle incoming message.

Parameters:

Name	Type	Description	Default
message	Any	incoming message (should be dict, but it is kept open also for other types).	required
*args		Can take any positional argument.	required
**kwargs		Can take any keyword argument.	required
Returns:

Name	Type	Description
out	Any	This function can return any output.
Source code in llama_index/voice_agents/gemini_live/base.py

@override
async def handle_message(self) -> Any:
    """
    Handle incoming message.

    Args:
        message (Any): incoming message (should be dict, but it is kept open also for other types).
        *args: Can take any positional argument.
        **kwargs: Can take any keyword argument.

    Returns:
        out (Any): This function can return any output.

    """
    while True:
        turn = self.session.receive()
        async for response in turn:
            if response.server_content:
                if data := response.data:
                    await self.interface.receive(data=data)
                    self._messages.append(
                        ChatMessage(
                            role="assistant", blocks=[AudioBlock(audio=data)]
                        )
                    )
                    self._events.append(
                        AudioReceivedEvent(type_t="audio_received", data=data)
                    )
                    continue
                if text := response.text:
                    self._messages.append(
                        ChatMessage(role="assistant", blocks=[TextBlock(text=text)])
                    )
                    self._events.append(
                        TextReceivedEvent(type_t="text_received", text=text)
                    )
            elif tool_call := response.tool_call:
                function_responses: List[types.FunctionResponse] = []
                for fn_call in tool_call.function_calls:
                    self._events.append(
                        ToolCallEvent(
                            type_t="tool_call",
                            tool_name=fn_call.name,
                            tool_args=fn_call.args,
                        )
                    )
                    result = self._functions_dict[fn_call.name](
                        fn_call.args, fn_call.id, fn_call.name
                    )
                    self._events.append(
                        ToolCallResultEvent(
                            type_t="tool_call_result",
                            tool_name=result.name,
                            tool_result=result.response,
                        )
                    )
                    function_responses.append(result)
                await self.session.send_tool_response(
                    function_responses=function_responses
                )
        while not self.interface.audio_in_queue.empty():
            await self.interrupt()
interrupt async #

interrupt() -> None
Interrupt the input/output audio flow.

Returns: out (None): This function does not return anything.

Source code in llama_index/voice_agents/gemini_live/base.py

async def interrupt(self) -> None:
    """
    Interrupt the input/output audio flow.

    Args:
        None
    Returns:
        out (None): This function does not return anything.

    """
    self.interface.interrupt()
stop async #

stop() -> None
Stop the conversation with the voice agent.

Returns: out (None): This function does not return anything.

Source code in llama_index/voice_agents/gemini_live/base.py

async def stop(self) -> None:
    """
    Stop the conversation with the voice agent.

    Args:
        None
    Returns:
        out (None): This function does not return anything.

    """
    self.interface.stop()
GeminiLiveVoiceAgentInterface #
Bases: BaseVoiceAgentInterface

Source code in llama_index/voice_agents/gemini_live/audio_interface.py

class GeminiLiveVoiceAgentInterface(BaseVoiceAgentInterface):
    def __init__(self) -> None:
        self.audio_in_queue: Optional[asyncio.Queue] = None
        self.out_queue: Optional[asyncio.Queue] = None

        self.session: Optional[AsyncSession] = None
        self.audio_stream: Optional[pyaudio.Stream] = None

    def _speaker_callback(self, *args: Any, **kwargs: Any) -> Any:
        """
        Callback function for the audio output device.

        Args:
            *args: Can take any positional argument.
            **kwargs: Can take any keyword argument.

        Returns:
            out (Any): This function can return any output.

        """

    @override
    async def _microphone_callback(self) -> None:
        """
        Callback function for the audio input device.

        Args:
            *args: Can take any positional argument.
            **kwargs: Can take any keyword argument.

        Returns:
            out (Any): This function can return any output.

        """
        mic_info = pya.get_default_input_device_info()
        self.audio_stream = await asyncio.to_thread(
            pya.open,
            format=FORMAT,
            channels=CHANNELS,
            rate=SEND_SAMPLE_RATE,
            input=True,
            input_device_index=mic_info["index"],
            frames_per_buffer=CHUNK_SIZE,
        )
        if __debug__:
            kwargs = {"exception_on_overflow": False}
        else:
            kwargs = {}
        while True:
            data = await asyncio.to_thread(self.audio_stream.read, CHUNK_SIZE, **kwargs)
            await self.out_queue.put({"data": data, "mime_type": "audio/pcm"})

    @override
    def start(self, session: AsyncSession) -> None:
        """
        Start the interface.

        Args:
            session (AsyncSession): the session to which the API is bound.

        """
        self.session = session
        self.audio_in_queue = asyncio.Queue()
        self.out_queue = asyncio.Queue(maxsize=5)

    def stop(self) -> None:
        """
        Stop the interface.

        Args:
            None
        Returns:
            out (None): This function does not return anything.

        """
        if self.audio_stream:
            self.audio_stream.close()
        else:
            raise ValueError("Audio stream has never been opened, cannot be closed.")

    def interrupt(self) -> None:
        """
        Interrupt the interface.

        Args:
            None
        Returns:
            out (None): This function does not return anything.

        """
        self.audio_in_queue.get_nowait()

    @override
    async def output(self, *args: Any, **kwargs: Any) -> Any:
        """
        Process and output the audio.

        Args:
            *args: Can take any positional argument.
            **kwargs: Can take any keyword argument.

        Returns:
            out (Any): This function can return any output.

        """
        stream = await asyncio.to_thread(
            pya.open,
            format=FORMAT,
            channels=CHANNELS,
            rate=RECEIVE_SAMPLE_RATE,
            output=True,
        )
        while True:
            bytestream = await self.audio_in_queue.get()
            await asyncio.to_thread(stream.write, bytestream)

    @override
    async def receive(self, data: bytes) -> Any:
        """
        Receive audio data.

        Args:
            data (Any): received audio data (generally as bytes or str, but it is kept open also to other types).
            *args: Can take any positional argument.
            **kwargs: Can take any keyword argument.

        Returns:
            out (Any): This function can return any output.

        """
        self.audio_in_queue.put_nowait(data)
start #

start(session: AsyncSession) -> None
Start the interface.

Parameters:

Name	Type	Description	Default
session	AsyncSession	the session to which the API is bound.	required
Source code in llama_index/voice_agents/gemini_live/audio_interface.py

@override
def start(self, session: AsyncSession) -> None:
    """
    Start the interface.

    Args:
        session (AsyncSession): the session to which the API is bound.

    """
    self.session = session
    self.audio_in_queue = asyncio.Queue()
    self.out_queue = asyncio.Queue(maxsize=5)
stop #

stop() -> None
Stop the interface.

Returns: out (None): This function does not return anything.

Source code in llama_index/voice_agents/gemini_live/audio_interface.py

def stop(self) -> None:
    """
    Stop the interface.

    Args:
        None
    Returns:
        out (None): This function does not return anything.

    """
    if self.audio_stream:
        self.audio_stream.close()
    else:
        raise ValueError("Audio stream has never been opened, cannot be closed.")
interrupt #

interrupt() -> None
Interrupt the interface.

Returns: out (None): This function does not return anything.

Source code in llama_index/voice_agents/gemini_live/audio_interface.py

def interrupt(self) -> None:
    """
    Interrupt the interface.

    Args:
        None
    Returns:
        out (None): This function does not return anything.

    """
    self.audio_in_queue.get_nowait()
output async #

output(*args: Any, **kwargs: Any) -> Any
Process and output the audio.

Parameters:

Name	Type	Description	Default
*args	Any	Can take any positional argument.	()
**kwargs	Any	Can take any keyword argument.	{}
Returns:

Name	Type	Description
out	Any	This function can return any output.
Source code in llama_index/voice_agents/gemini_live/audio_interface.py

@override
async def output(self, *args: Any, **kwargs: Any) -> Any:
    """
    Process and output the audio.

    Args:
        *args: Can take any positional argument.
        **kwargs: Can take any keyword argument.

    Returns:
        out (Any): This function can return any output.

    """
    stream = await asyncio.to_thread(
        pya.open,
        format=FORMAT,
        channels=CHANNELS,
        rate=RECEIVE_SAMPLE_RATE,
        output=True,
    )
    while True:
        bytestream = await self.audio_in_queue.get()
        await asyncio.to_thread(stream.write, bytestream)
receive async #

receive(data: bytes) -> Any
Receive audio data.

Parameters:

Name	Type	Description	Default
data	Any	received audio data (generally as bytes or str, but it is kept open also to other types).	required
*args		Can take any positional argument.	required
**kwargs		Can take any keyword argument.	required
Returns:

Name	Type	Description
out	Any	This function can return any output.
Source code in llama_index/voice_agents/gemini_live/audio_interface.py

@override
async def receive(self, data: bytes) -> Any:
    """
    Receive audio data.

    Args:
        data (Any): received audio data (generally as bytes or str, but it is kept open also to other types).
        *args: Can take any positional argument.
        **kwargs: Can take any keyword argument.

    Returns:
        out (Any): This function can return any output.

    """
    self.audio_in_queue.put_nowait(data)