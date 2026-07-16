import 'package:auto_gpt_flutter_client/utils/stack.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('LifoStack', () {
    test('stores elements in last-in, first-out order', () {
      final stack = LifoStack<int>();

      expect(stack.isEmpty, isTrue);
      expect(stack.length, 0);

      stack.push(1);
      stack.push(2);
      stack.push(3);

      expect(stack.isNotEmpty, isTrue);
      expect(stack.length, 3);
      expect(stack.pop(), 3);
      expect(stack.pop(), 2);
      expect(stack.pop(), 1);
      expect(stack.isEmpty, isTrue);
    });

    test('peek returns the next element without removing it', () {
      final stack = LifoStack<String>()..push('first');

      expect(stack.peek(), 'first');
      expect(stack.peek(), 'first');
      expect(stack.length, 1);
    });

    test('pop explains why an empty stack cannot be changed', () {
      final stack = LifoStack<int>();

      expect(
        stack.pop,
        throwsA(
          isA<StateError>().having(
            (error) => error.message,
            'message',
            'Cannot pop from an empty stack.',
          ),
        ),
      );
    });

    test('peek explains why an empty stack cannot be read', () {
      final stack = LifoStack<int>();

      expect(
        stack.peek,
        throwsA(
          isA<StateError>().having(
            (error) => error.message,
            'message',
            'Cannot peek at an empty stack.',
          ),
        ),
      );
    });

    test('does not conflict with the Flutter Stack widget', () {
      final dataStack = LifoStack<int>()..push(42);
      const widgetStack = Stack();

      expect(dataStack.peek(), 42);
      expect(widgetStack, isA<Stack>());
    });
  });
}
