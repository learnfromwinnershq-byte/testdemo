#import <AVFoundation/AVFoundation.h>
#import <Foundation/Foundation.h>

static void Fail(NSString *message) {
  fprintf(stderr, "%s\n", message.UTF8String);
  exit(1);
}

int main(int argc, const char *argv[]) {
  @autoreleasepool {
    if (argc != 4) {
      Fail(@"usage: speech-writer <book.json> <chapter-id> <output-directory>");
    }

    NSString *jsonPath = [NSString stringWithUTF8String:argv[1]];
    NSString *chapterId = [NSString stringWithUTF8String:argv[2]];
    NSString *outputDirectory = [NSString stringWithUTF8String:argv[3]];
    NSData *jsonData = [NSData dataWithContentsOfFile:jsonPath];
    if (!jsonData) Fail(@"unable to read book JSON");

    NSError *error = nil;
    NSDictionary *book = [NSJSONSerialization JSONObjectWithData:jsonData options:0 error:&error];
    if (!book || error) Fail(error.localizedDescription ?: @"invalid book JSON");

    NSDictionary *chapter = nil;
    for (NSDictionary *candidate in book[@"chapters"]) {
      if ([candidate[@"id"] isEqualToString:chapterId]) {
        chapter = candidate;
        break;
      }
    }
    if (!chapter) Fail(@"chapter not found");

    NSFileManager *files = NSFileManager.defaultManager;
    [files createDirectoryAtPath:outputDirectory withIntermediateDirectories:YES attributes:nil error:&error];
    if (error) Fail(error.localizedDescription);

    NSString *cafPath = [outputDirectory stringByAppendingPathComponent:[chapterId stringByAppendingString:@".caf"]];
    NSString *cuePath = [outputDirectory stringByAppendingPathComponent:[chapterId stringByAppendingString:@".cues.json"]];
    [files removeItemAtPath:cafPath error:nil];

    AVSpeechSynthesisVoice *voice = [AVSpeechSynthesisVoice voiceWithLanguage:@"zh-HK"];
    if (!voice) Fail(@"zh-HK system voice is unavailable");

    AVSpeechSynthesizer *synthesizer = [[AVSpeechSynthesizer alloc] init];
    __block AVAudioFile *audioFile = nil;
    __block double sampleRate = 0;
    __block AVAudioFramePosition currentFrame = 0;
    NSMutableArray *cues = [NSMutableArray array];
    NSArray *sentences = chapter[@"sentences"];

    for (NSUInteger index = 0; index < sentences.count; index++) {
      NSDictionary *sentence = sentences[index];
      NSString *text = sentence[@"text"];
      if (text.length == 0) continue;

      AVAudioFramePosition startFrame = currentFrame;
      __block BOOL finished = NO;
      __block NSString *callbackError = nil;
      AVSpeechUtterance *utterance = [AVSpeechUtterance speechUtteranceWithString:text];
      utterance.voice = voice;
      utterance.rate = 0.43;
      utterance.preUtteranceDelay = 0;
      utterance.postUtteranceDelay = 0.12;

      [synthesizer writeUtterance:utterance toBufferCallback:^(AVAudioBuffer *buffer) {
        AVAudioPCMBuffer *pcm = (AVAudioPCMBuffer *)buffer;
        if (pcm.frameLength == 0) {
          finished = YES;
          return;
        }

        if (!audioFile) {
          sampleRate = pcm.format.sampleRate;
          NSURL *url = [NSURL fileURLWithPath:cafPath];
          NSError *fileError = nil;
          audioFile = [[AVAudioFile alloc] initForWriting:url settings:pcm.format.settings error:&fileError];
          if (fileError) {
            callbackError = fileError.localizedDescription;
            finished = YES;
            return;
          }
        }

        NSError *writeError = nil;
        [audioFile writeFromBuffer:pcm error:&writeError];
        if (writeError) {
          callbackError = writeError.localizedDescription;
          finished = YES;
          return;
        }
        currentFrame += pcm.frameLength;
      }];

      while (!finished) {
        [NSRunLoop.currentRunLoop runUntilDate:[NSDate dateWithTimeIntervalSinceNow:0.02]];
      }
      if (callbackError) Fail(callbackError);

      double startMs = sampleRate > 0 ? ((double)startFrame / sampleRate) * 1000.0 : 0;
      double endMs = sampleRate > 0 ? ((double)currentFrame / sampleRate) * 1000.0 : startMs;
      [cues addObject:@{
        @"id": sentence[@"id"],
        @"startMs": @(llround(startMs)),
        @"endMs": @(llround(endMs)),
        @"text": text,
      }];

      if ((index + 1) % 25 == 0 || index + 1 == sentences.count) {
        printf("%s %lu/%lu\n", chapterId.UTF8String, (unsigned long)(index + 1), (unsigned long)sentences.count);
        fflush(stdout);
      }
    }

    NSDictionary *cueDocument = @{
      @"chapterId": chapterId,
      @"title": chapter[@"title"],
      @"durationMs": @(sampleRate > 0 ? llround(((double)currentFrame / sampleRate) * 1000.0) : 0),
      @"voice": voice.identifier ?: @"zh-HK",
      @"cues": cues,
    };
    NSData *cueData = [NSJSONSerialization dataWithJSONObject:cueDocument options:0 error:&error];
    if (!cueData || error) Fail(error.localizedDescription ?: @"unable to encode cues");
    if (![cueData writeToFile:cuePath options:NSDataWritingAtomic error:&error]) Fail(error.localizedDescription);
  }
  return 0;
}
